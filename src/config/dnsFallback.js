import dns from "node:dns";
import https from "node:https";

/* ------------------------------------------------------------------
 * Safer address lookups for outside services (Cloudinary and friends)
 *
 * Some home routers and ISPs in Egypt answer DNS lookups badly. That shows
 * up as "getaddrinfo ENOTFOUND api.cloudinary.com" or a request that just
 * hangs. We first ask this computer's DNS as usual; if it fails or is slow,
 * we ask public DNS (Cloudflare and Google) instead. Answers are remembered
 * for a few minutes so we don't look the same name up again and again.
 * The same idea already protects the MongoDB connection (see db.js).
 * ------------------------------------------------------------------ */

// .env DNS_FALLBACK_SERVERS can list other servers (comma separated)
const PUBLIC_DNS = (process.env.DNS_FALLBACK_SERVERS || "1.1.1.1,8.8.8.8,1.0.0.1,8.8.4.4")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const SYSTEM_TIMEOUT_MS = 3000;
const CACHE_MS = 5 * 60 * 1000;

const publicResolver = new dns.promises.Resolver({ timeout: 2500, tries: 2 });
publicResolver.setServers(PUBLIC_DNS);

const systemLookup = dns.lookup.bind(dns);
const cache = new Map(); // hostname -> { addresses: [{address, family}], until }

const systemLookupAll = (hostname, family) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("DNS lookup timed out")), SYSTEM_TIMEOUT_MS);
    systemLookup(hostname, { all: true, family }, (err, addresses) => {
      clearTimeout(timer);
      if (err || !addresses?.length) return reject(err || new Error("no address"));
      resolve(addresses);
    });
  });

const publicLookupAll = async (hostname, family) => {
  const list = [];
  if (family !== 6) {
    try {
      (await publicResolver.resolve4(hostname)).forEach((address) => list.push({ address, family: 4 }));
    } catch {
      /* try IPv6 below */
    }
  }
  if (!list.length && family !== 4) {
    try {
      (await publicResolver.resolve6(hostname)).forEach((address) => list.push({ address, family: 6 }));
    } catch {
      /* nothing found */
    }
  }
  if (!list.length) {
    const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
    err.code = "ENOTFOUND";
    err.hostname = hostname;
    throw err;
  }
  return list;
};

/** Drop-in replacement for dns.lookup, with the public DNS fallback. */
export function resilientLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (typeof options === "number") options = { family: options };
  const family = options?.family || 0;
  const wantAll = Boolean(options?.all);
  const reply = (addresses) =>
    wantAll ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);

  const cached = cache.get(hostname);
  if (cached && cached.until > Date.now()) return reply(cached.addresses);

  systemLookupAll(hostname, family)
    .catch(() => publicLookupAll(hostname, family))
    .then((addresses) => {
      cache.set(hostname, { addresses, until: Date.now() + CACHE_MS });
      reply(addresses);
    })
    .catch((err) => callback(err));
}

// On Vercel (VERCEL=1, set automatically) DNS is reliable, so the workaround
// is switched off there and Node's normal lookup is used.
const ON_VERCEL = Boolean(process.env.VERCEL);

/** One shared HTTPS agent that uses the safer lookup (plain lookup on Vercel). */
export const resilientAgent = new https.Agent(
  ON_VERCEL ? { keepAlive: true } : { keepAlive: true, lookup: resilientLookup },
);

// Every other HTTPS request made with Node's default agent gets it too.
if (!ON_VERCEL) https.globalAgent.options.lookup = resilientLookup;

/** True for errors that are worth one quick retry (network hiccups). */
export const isNetworkHiccup = (error) => {
  const code = error?.code || error?.error?.code;
  const http = error?.http_code || error?.error?.http_code;
  const name = error?.name || error?.error?.name;
  return (
    ["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"].includes(code) ||
    http === 499 ||
    name === "TimeoutError" ||
    /timed? ?out|ENOTFOUND|EAI_AGAIN/i.test(error?.message || error?.error?.message || "")
  );
};
