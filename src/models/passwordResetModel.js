import mongoose from "mongoose";

// When a customer uses "Forgot password", we don't email them (by design).
// Instead we record a request here so an admin sees it in the dashboard and
// can call the customer or set a new password for them.

const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" }, // snapshot, so it still reads well if the user is gone
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    status: { type: String, enum: ["pending", "resolved"], default: "pending", index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

passwordResetSchema.index({ createdAt: -1 });
// Finding a still-open request for a given account (dedupe on forgot-password)
passwordResetSchema.index({ user: 1, status: 1 });

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

export default PasswordReset;
