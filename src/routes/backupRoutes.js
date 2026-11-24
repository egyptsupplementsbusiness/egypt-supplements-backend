import express from "express";
import zlib from "node:zlib";
import mongoose from "mongoose";
import { protect, admin } from "../middleware/authMiddleware.js";
import { logEvent } from "../utils/logger.js";

// Download the whole shop database as one file, and put a file back.
// The file is compressed JSON (.json.gz) that keeps ids and dates exactly.
// Vercel allows about 4.5 MB per request, so a backup file must stay under
// 4 MB to be restored (compressed, that's a very large shop).

const { EJSON } = mongoose.mongo.BSON;
const APP = "egypt-supplements";
const FORMAT_VERSION = 1;
// Not worth keeping: short-lived counters, and the log itself
const SKIP = new Set(["ratelimits", "logs"]);
const MAX_RESTORE_BYTES = 4 * 1024 * 1024;

const router = express.Router();

const shopCollections = async () =>
  (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !SKIP.has(name) && !name.startsWith("system."));

// ---------------------------- Download a backup ----------------------------
router.get("/backup", protect, admin, async (req, res) => {
  const db = mongoose.connection.db;
  const collections = {};
  const counts = {};
  for (const name of await shopCollections()) {
    collections[name] = await db.collection(name).find().toArray();
    counts[name] = collections[name].length;
  }
  const file = {
    app: APP,
    version: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
    counts,
    collections,
  };
  const gz = zlib.gzipSync(Buffer.from(EJSON.stringify(file, { relaxed: false })));
  const day = new Date().toISOString().slice(0, 10);

  await logEvent("admin", "Downloaded a backup of the shop", { user: req.user, details: counts });
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="egypt-supplements-backup-${day}.json.gz"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(gz);
});

// ---------------------------- Restore from a backup ----------------------------
// Replaces EVERYTHING in the shop with what's in the file. The admin page
// downloads a fresh backup first, and asks the admin to type RESTORE.
router.post(
  "/restore",
  protect,
  admin,
  express.raw({ type: "application/octet-stream", limit: MAX_RESTORE_BYTES }),
  async (req, res) => {
    if (req.query.confirm !== "RESTORE") {
      res.status(400);
      throw new Error("Please confirm the restore first.");
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400);
      throw new Error("No backup file was received. Please choose the file again.");
    }

    // 1. Read and check the file before touching anything
    let file;
    try {
      const raw = req.body[0] === 0x1f && req.body[1] === 0x8b ? zlib.gunzipSync(req.body) : req.body;
      file = EJSON.parse(raw.toString("utf8"), { relaxed: false });
    } catch {
      res.status(400);
      throw new Error("This file isn't a shop backup (it couldn't be read). Nothing was changed.");
    }
    if (file?.app !== APP || typeof file.collections !== "object" || !file.collections) {
      res.status(400);
      throw new Error("This file isn't a backup from this shop. Nothing was changed.");
    }
    const users = file.collections.users || [];
    if (!users.some((u) => u.role === "admin" && u.isActive !== false)) {
      res.status(400);
      throw new Error("This backup has no admin account, so nobody could sign in after restoring it. Nothing was changed.");
    }
    const names = Object.keys(file.collections).filter((name) => !SKIP.has(name) && Array.isArray(file.collections[name]));

    // 2. Replace each collection
    const db = mongoose.connection.db;
    const restored = {};
    for (const name of new Set([...(await shopCollections()), ...names])) {
      const docs = file.collections[name] || [];
      await db.collection(name).deleteMany({});
      if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
      restored[name] = docs.length;
    }

    await logEvent("admin", `Restored the shop from a backup made ${String(file.createdAt || "").slice(0, 10) || "earlier"}`, {
      user: req.user,
      details: restored,
    });
    res.status(200).json({ message: "Restored", restored, backupDate: file.createdAt || null });
  },
);

export default router;
