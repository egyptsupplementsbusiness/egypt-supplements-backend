// DANGER: empties the shop's database (products, orders, accounts, settings,
// everything), then sets it up fresh with the starter categories, default
// settings, one admin account and one customer account.
// Run it with reset-database.bat. It asks before doing anything, and saves a
// full copy of the database to a file first, so nothing is lost for good.
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/userModel.js";
import { seedCategories } from "../src/models/categoryModel.js";
import { getSettings } from "../src/models/settingsModel.js";

dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
const askHidden = (question) =>
  new Promise((resolve) => {
    let muted = false;
    const original = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (!muted) return original.call(rl, text);
      if (text.includes("\n") || text.includes("\r")) return original.call(rl, "\n");
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
const askAccount = async (label) => {
  let email;
  for (;;) {
    email = (await ask(`${label} email: `)).toLowerCase();
    if (EMAIL_RE.test(email)) break;
    console.log("  That doesn't look like an email address.\n");
  }
  for (;;) {
    const p1 = await askHidden(`${label} password (at least 8 characters): `);
    if (p1.length < 8) {
      console.log("  Too short.\n");
      continue;
    }
    const p2 = await askHidden("Type it again: ");
    if (p1 === p2) return { email, password: p1 };
    console.log("  They didn't match.\n");
  }
};

const run = async () => {
  console.log("\n=== EMPTY THE SHOP DATABASE ===");
  console.log("This deletes EVERY product, order, customer account, admin account and setting");
  console.log("on the LIVE shop. A copy is saved to a file on this computer first.\n");
  const sure = await ask('Type WIPE (in capitals) to continue, or anything else to stop: ');
  if (sure !== "WIPE") {
    console.log("Stopped. Nothing was changed.");
    return;
  }

  console.log("\nFirst, the two accounts to create afterwards:");
  const admin = await askAccount("Admin");
  const customer = await askAccount("Test customer");

  await connectDB();
  const db = mongoose.connection.db;

  // 1. Full copy first
  const backup = {};
  for (const { name } of await db.listCollections().toArray()) {
    backup[name] = await db.collection(name).find().toArray();
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.resolve(process.cwd(), "..", "..", `db-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup));
  console.log(`\nSaved a copy of everything to:\n  ${file}`);
  console.log("Counts:", Object.entries(backup).map(([k, v]) => `${k} ${v.length}`).join(", "));

  // 2. Empty every collection (indexes stay)
  for (const name of Object.keys(backup)) {
    await db.collection(name).deleteMany({});
  }
  console.log("\nDatabase emptied.");

  // 3. Fresh start
  await getSettings();
  await seedCategories();
  await User.create({ name: "Shop Admin", email: admin.email, password: admin.password, phone: "01000000000", role: "admin" });
  await User.create({ name: "Test Customer", email: customer.email, password: customer.password, phone: "01000000001", role: "user" });
  console.log("Created the default settings, the 4 starter categories and both accounts.");
  console.log(`\nDONE. Sign in as admin with ${admin.email}, or as a customer with ${customer.email}.`);
};

run()
  .catch((err) => {
    console.error("\nFAILED: " + err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    mongoose.connection.removeAllListeners("disconnected");
    await mongoose.disconnect();
  });
