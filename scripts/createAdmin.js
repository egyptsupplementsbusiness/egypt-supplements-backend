// One-off script: creates (or upgrades) the site's admin account.
// Run from the back-end folder:  node scripts/createAdmin.js
// Uses MONGO_URI from back-end/.env and the app's own User model, so the
// password is hashed by the model's pre-save hook exactly like /register.
// Safe to re-run: if the email already exists, it is promoted to admin,
// re-activated and its password is reset to ADMIN_PASSWORD from back-end/.env.
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/userModel.js";

dotenv.config();

const ADMIN = {
  name: "Tarek (Admin)",
  email: "admin@egyptsupplements.com",
  password: process.env.ADMIN_PASSWORD,
  phone: "01000000000",
};

const run = async () => {
  if (!process.env.ADMIN_PASSWORD) {
    console.log("Add an ADMIN_PASSWORD=... line to back-end/.env first, then run this again. Nothing was changed.");
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Run this from the back-end folder that has the .env file.");
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  let user = await User.findOne({ email: ADMIN.email }).select("+password");
  if (user) {
    user.role = "admin";
    user.isActive = true;
    user.password = ADMIN.password; // re-hashed by the pre-save hook
    await user.save();
    console.log("Existing account found: promoted to admin and password reset.");
  } else {
    user = await User.create({ ...ADMIN, role: "admin" });
    console.log("New admin account created.");
  }

  const check = await User.findById(user._id).select("+password");
  const ok = check.role === "admin" && (await check.matchPassword(ADMIN.password));
  console.log("");
  console.log(ok ? "SUCCESS - you can now log in with:" : "WARNING - account saved but verification failed.");
  console.log("  Email   : " + ADMIN.email);
  console.log("  Password: " + ADMIN.password);
  console.log("  Role    : " + check.role);
};

run()
  .catch((err) => {
    console.error("FAILED: " + err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
