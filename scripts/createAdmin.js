// Creates an admin account, or turns an existing account into an admin and
// gives it a new password. Run it with create-admin.bat (or from the back-end
// folder: node scripts/createAdmin.js).
//
// It asks for the email and a new password every time. Nothing is saved in
// files, and the password is never shown on screen.
// Uses MONGO_URI from back-end/.env and the app's own User model, so the
// password is hashed exactly like a normal sign-up.
import dotenv from "dotenv";
import mongoose from "mongoose";
import readline from "node:readline";
import User from "../src/models/userModel.js";
import connectDB from "../src/config/db.js";

dotenv.config();

// ---------------------------- Asking questions ----------------------------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));

// Same as ask(), but whatever is typed is hidden (shows * instead)
const askHidden = (question) =>
  new Promise((resolve) => {
    let muted = false;
    const original = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (!muted) return original.call(rl, text);
      // Keep line breaks, hide everything else
      if (text.includes("\n") || text.includes("\r")) return original.call(rl, "\n");
      // A redraw (e.g. after Backspace) repeats the question, then the typing
      if (text.startsWith(question)) return original.call(rl, question + "*".repeat(rl.line.length));
      return original.call(rl, "*".repeat(text.length));
    };
    rl.question(question, (answer) => {
      rl._writeToOutput = original;
      resolve(answer);
    });
    muted = true;
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const askEmail = async () => {
  for (;;) {
    const email = (await ask("Admin email: ")).toLowerCase();
    if (EMAIL_RE.test(email)) return email;
    console.log("  That doesn't look like an email address. Please try again.\n");
  }
};

const askNewPassword = async () => {
  for (;;) {
    const first = await askHidden("New password (at least 8 characters): ");
    if (first.length < 8) {
      console.log("  Too short. Please use at least 8 characters.\n");
      continue;
    }
    const second = await askHidden("Type the same password again: ");
    if (first !== second) {
      console.log("  The two passwords didn't match. Please try again.\n");
      continue;
    }
    return first;
  }
};

// ---------------------------- Main ----------------------------
const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Run this from the back-end folder that has the .env file.");
  }

  console.log("");
  console.log("=== Create or reset an admin account ===");
  console.log("Type the email to use for signing in to the admin dashboard.");
  console.log("If an account with this email exists, it becomes an admin and gets the new password.");
  console.log("");

  const email = await askEmail();

  console.log("Connecting to the database...");
  await connectDB(); // retries, and works around bad home-internet DNS

  let user = await User.findOne({ email }).select("+password");
  let name = "";
  if (user) {
    console.log(`Found the account of "${user.name}". It will be an admin with the new password you choose.\n`);
  } else {
    console.log("There is no account with this email yet, so a new admin account will be made.");
    name = (await ask('Name to show for this admin (press Enter for "Shop Admin"): ')) || "Shop Admin";
    console.log("");
  }

  const password = await askNewPassword();

  if (user) {
    user.role = "admin";
    user.isActive = true;
    user.deactivatedBy = null;
    user.password = password; // hashed by the model before saving
    await user.save();
    console.log("\nDone: the account is now an admin with the new password.");
  } else {
    user = await User.create({ name, email, password, phone: "01000000000", role: "admin" });
    console.log("\nDone: new admin account created.");
  }

  const check = await User.findById(user._id).select("+password");
  const ok = check.role === "admin" && (await check.matchPassword(password));
  console.log("");
  console.log(ok ? "SUCCESS - you can now sign in with:" : "WARNING - the account was saved but the check failed.");
  console.log("  Email   : " + email);
  console.log("  Password: (the one you just typed)");
  console.log("  Role    : " + check.role);
};

run()
  .catch((err) => {
    console.error("\nFAILED: " + err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    mongoose.connection.removeAllListeners("disconnected"); // no "reconnecting" note on exit
    await mongoose.disconnect();
  });
