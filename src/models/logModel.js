import mongoose from "mongoose";

// The admin "Activity log": website errors, what admins changed, and a few
// important customer events (new account, order placed or cancelled).
// Kept for 90 days, then MongoDB removes old entries by itself.
export const LOG_TYPES = ["error", "admin", "customer", "security"];
const KEEP_DAYS = 90;

const logSchema = new mongoose.Schema(
  {
    type: { type: String, enum: LOG_TYPES, required: true },
    // Short plain description, e.g. "Changed order ES2611240123 to Delivered"
    message: { type: String, required: true, maxlength: 500 },
    // Who did it (a snapshot, so it still reads well if the account is gone)
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    // Extra details for errors (page, technical message). Kept small.
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

logSchema.index({ createdAt: -1 });
logSchema.index({ type: 1, createdAt: -1 });
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 60 * 60 });

const Log = mongoose.model("Log", logSchema);

export default Log;
