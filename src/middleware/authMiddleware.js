import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

// ---------------------------- Authentication Middleware for Normal Users ----------------------------
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, token failed or expired");
  }

  const user = await User.findById(decoded.id).select("-password");

  // The account was deleted after the token was issued
  if (!user) {
    res.status(401);
    throw new Error("Not authorized, user no longer exists");
  }

  // The password changed after this token was issued: it's now stale, so the
  // old device has to sign in again. (This also covers an admin reset.)
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
    res.status(401);
    throw new Error("Your session has expired. Please sign in again.");
  }

  // The account was suspended after the token was issued
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated. Please contact support.");
  }

  req.user = user;
  next();
};

// ---------------------------- Authorization Middleware for Admins ----------------------------
export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized as an admin");
  }
};
