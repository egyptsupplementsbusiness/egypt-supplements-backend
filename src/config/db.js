import dns from "node:dns";
import mongoose from "mongoose";

// How long to wait for MongoDB Atlas to answer before giving up on one try.
// Atlas on a slow or unstable connection can take 10+ seconds.
// On Vercel (serverless) a request can only wait a few seconds, and Vercel's
// own DNS is reliable, so we try fewer times, give up sooner and skip the
// home-internet DNS workaround below. Vercel sets VERCEL=1 automatically.
const ON_VERCEL = Boolean(process.env.VERCEL);
const SERVER_SELECTION_TIMEOUT_MS = ON_VERCEL ? 8000 : 20000;
const MAX_ATTEMPTS = ON_VERCEL ? 2 : 5;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------
 * DNS
 * Some home routers and ISPs in Egypt answer DNS lookups badly. That shows
 * up as "querySrv ESERVFAIL" or "getaddrinfo ENOTFOUND ...mongodb.net".
 * So we look the database addresses up ourselves: first with public DNS
 * (Cloudflare and Google), then with this computer's own DNS, each with a
 * short time limit, so a bad answer never leaves the server stuck.
 * .env MONGO_DNS_SERVERS: other servers (comma separated), or "system" to
 * use only this computer's DNS.
 * ------------------------------------------------------------------ */
const usePublicDns = !ON_VERCEL && process.env.MONGO_DNS_SERVERS !== "system";
const PUBLIC_DNS = (
  usePublicDns && process.env.MONGO_DNS_SERVERS
    ? process.env.MONGO_DNS_SERVERS
    : "1.1.1.1,8.8.8.8,1.0.0.1,8.8.4.4"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const makeResolver = (servers, label) => {
  const resolver = new dns.promises.Resolver({ timeout: 2500, tries: 1 });
  try {
    if (servers) resolver.setServers(servers);
  } catch {
    return null; // invalid list in .env
  }
  resolver.label = label;
  return resolver;
};

const RESOLVERS = [
  usePublicDns && makeResolver(PUBLIC_DNS, "public DNS"),
  makeResolver(dns.getServers(), "this computer's DNS"),
].filter(Boolean);

// Never let one lookup hang for long
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS lookup timed out")), ms)),
  ]);

/**
 * Turns "mongodb+srv://user:pass@cluster.xxx.mongodb.net/db?x=y" into a plain
 * "mongodb://user:pass@host1:27017,host2:27017,.../db?tls=true&..." address,
 * the same thing the MongoDB driver does, but with our DNS fallbacks.
 */
const expandSrvUri = async (uri) => {
  const match = uri.match(/^mongodb\+srv:\/\/(?:([^@/]*)@)?([^/?]+)(\/[^?]*)?(?:\?(.*))?$/);
  if (!match) throw new Error("MONGO_URI doesn't look like a valid mongodb+srv:// address");
  const [, userInfo, host, path = "/", query = ""] = match;

  let lastError;
  for (const resolver of RESOLVERS) {
    try {
      const records = await withTimeout(resolver.resolveSrv(`_mongodb._tcp.${host}`), 8000);
      if (!records.length) throw new Error("no database servers found");
      let txt = "";
      try {
        const txtRecords = await withTimeout(resolver.resolveTxt(host), 8000);
        txt = txtRecords.map((parts) => parts.join("")).join("&");
      } catch {
        // TXT only adds defaults (replicaSet, authSource), the URI can still work
      }

      const params = new URLSearchParams(txt);
      for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
      if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");

      const hosts = records.map((r) => `${r.name}:${r.port}`).join(",");
      const auth = userInfo ? `${userInfo}@` : "";
      return { uri: `mongodb://${auth}${hosts}${path}?${params}`, dnsUsed: resolver.label };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

/** Finds a database server's IP: this computer's DNS first, then public DNS. */
const lookupWithFallback = (hostname, options, callback) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const opts = typeof options === "number" ? { family: options } : options || {};
  dns.lookup(hostname, opts, async (err, address, family) => {
    if (!err) return callback(null, address, family);
    for (const resolver of RESOLVERS) {
      try {
        const addresses = await withTimeout(resolver.resolve4(hostname), 6000);
        if (!addresses.length) continue;
        if (opts.all) return callback(null, addresses.map((a) => ({ address: a, family: 4 })));
        return callback(null, addresses[0], 4);
      } catch {
        // try the next one
      }
    }
    return callback(err);
  });
};

let listenersAdded = false;
const addConnectionListeners = () => {
  if (listenersAdded) return;
  listenersAdded = true;
  mongoose.connection.on("disconnected", () =>
    console.warn("⚠️  MongoDB disconnected. Trying to reconnect..."),
  );
  mongoose.connection.on("reconnected", () => console.log("🔌 MongoDB reconnected"));
  mongoose.connection.on("error", (error) =>
    console.error(`❌ MongoDB error: ${error.message}`),
  );
};

/**
 * Connects to MongoDB, retrying a few times (5s, 10s, 20s...) before giving up.
 * Resolves once the database is ready, so the server only starts taking
 * requests when it can actually answer them.
 */
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from the .env file");
  }
  addConnectionListeners();

  // On Vercel the database driver looks the address up itself (no workaround needed)
  const isSrv = !ON_VERCEL && process.env.MONGO_URI.startsWith("mongodb+srv://");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`⏳ Connecting to MongoDB (try ${attempt} of ${MAX_ATTEMPTS})...`);
    try {
      let uri = process.env.MONGO_URI;
      let dnsUsed = null;
      if (isSrv) {
        try {
          ({ uri, dnsUsed } = await expandSrvUri(uri));
        } catch (error) {
          throw new Error(
            `Couldn't look up the database address (${error.code || error.message}). Is the internet working?`,
          );
        }
      }

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
        // Use IPv4. On many Windows/home networks the IPv6 route to Atlas is
        // broken, which shows up as random "could not connect" errors.
        family: 4,
        // If this computer's DNS can't find a database server, ask public DNS
        ...(ON_VERCEL ? {} : { lookup: lookupWithFallback }),
        // Serverless: keep few connections open per copy of the app, so the
        // free Atlas plan (500 connections) is never used up
        ...(ON_VERCEL ? { maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000 } : {}),
      });
      console.log(`🔌 MongoDB connected${dnsUsed ? ` (address found with ${dnsUsed})` : ""}`);
      return;
    } catch (error) {
      console.error(
        `❌ MongoDB connection failed (try ${attempt} of ${MAX_ATTEMPTS}): ${error.message}`,
      );
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          "   Check your internet connection, and that your current IP address is allowed in MongoDB Atlas > Network Access.",
        );
        throw error;
      }
      const delay = ON_VERCEL ? 1000 : Math.min(5000 * 2 ** (attempt - 1), 30000);
      console.log(`   Trying again in ${delay / 1000} seconds...`);
      await wait(delay);
    }
  }
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * For Vercel: connect once and reuse that connection for every request the
 * same copy of the app answers. If connecting fails, the next request tries
 * again instead of being stuck with the failure.
 */
let connecting = null;
export const connectDBOnce = () => {
  if (isDbConnected()) return Promise.resolve();
  if (!connecting) {
    connecting = connectDB().catch((error) => {
      connecting = null;
      throw error;
    });
  }
  return connecting;
};

export default connectDB;
