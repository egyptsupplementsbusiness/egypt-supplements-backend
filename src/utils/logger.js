import Log from "../models/logModel.js";

const clip = (value, max) => {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * Adds one line to the admin Activity log. Never throws and never slows the
 * request down noticeably: if logging fails, it's just printed to the console.
 */
export const logEvent = async (type, message, { user = null, details = null } = {}) => {
  try {
    await Log.create({
      type,
      message: clip(message, 500),
      user: user ? { id: user._id || user.id || null, name: clip(user.name, 80), email: clip(user.email, 120) } : {},
      details,
    });
  } catch (error) {
    console.error("Couldn't write to the activity log:", error.message);
  }
};

/** Same, but doesn't wait (for places where the reply shouldn't wait on it). */
export const logLater = (type, message, options) => {
  logEvent(type, message, options).catch(() => {});
};
