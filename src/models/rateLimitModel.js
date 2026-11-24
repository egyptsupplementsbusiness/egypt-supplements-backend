import mongoose from "mongoose";

// Counters for "too many attempts" limits (sign-in, forgot password).
// Kept in the database rather than in memory because on Vercel every request
// can be answered by a different copy of the app, and memory isn't shared.
// MongoDB deletes each counter by itself once its time window is over.
const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// TTL index: the document is removed shortly after expiresAt
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit = mongoose.model("RateLimit", rateLimitSchema);

export default RateLimit;
