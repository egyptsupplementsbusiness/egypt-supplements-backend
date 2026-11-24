import RateLimit from "../models/rateLimitModel.js";

// Database-backed attempt counters, shared by every copy of the app on Vercel.
// If the database can't be reached for a counter, the request is let through
// rather than locking real customers out.

const minutesLeft = (expiresAt) => Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));

const waitText = (minutes) => (minutes === 1 ? "1 minute" : `${minutes} minutes`);

/** The live counter for a key, or null when there is none (or it ran out). */
const current = async (key) => {
  try {
    return await RateLimit.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  } catch (error) {
    console.error("Rate limit check failed:", error.message);
    return null;
  }
};

/**
 * Adds one to a counter. A new time window starts when there is no counter
 * yet or the old window is over. Returns the counter after the change.
 */
export const hit = async (key, windowMs) => {
  const now = new Date();
  try {
    const live = { $gt: ["$expiresAt", now] };
    return await RateLimit.collection.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            count: { $cond: [live, { $add: ["$count", 1] }, 1] },
            expiresAt: { $cond: [live, "$expiresAt", new Date(now.getTime() + windowMs)] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    console.error("Rate limit update failed:", error.message);
    return null;
  }
};

/** Forget a counter (for example after a successful sign-in). */
export const clear = async (key) => {
  try {
    await RateLimit.deleteOne({ key });
  } catch {
    // Not important: it runs out by itself
  }
};

/**
 * Throws a 429 "please wait" error when any of the given limits is used up.
 * limits: [{ key, max }]
 */
export const assertNotLimited = async (res, limits, message) => {
  for (const { key, max } of limits) {
    const counter = await current(key);
    if (counter && counter.count >= max) {
      const minutes = minutesLeft(counter.expiresAt);
      res.status(429);
      res.set("Retry-After", String(minutes * 60));
      throw new Error(`${message} Please wait ${waitText(minutes)} and try again.`);
    }
  }
};

/** The visitor's address, as best we can tell behind Vercel's proxy. */
export const clientIp = (req) => req.ip || req.headers["x-real-ip"] || "unknown";

// ---------------------------- The shop's limits ----------------------------
const MINUTE = 60 * 1000;

export const LIMITS = {
  // Wrong passwords for one account from one address
  loginPerAccount: { max: 5, windowMs: 15 * MINUTE },
  // Wrong passwords from one address across all accounts
  loginPerIp: { max: 20, windowMs: 15 * MINUTE },
  // "Forgot password" requests
  forgotPerIp: { max: 5, windowMs: 60 * MINUTE },
  forgotPerEmail: { max: 3, windowMs: 60 * MINUTE },
};
