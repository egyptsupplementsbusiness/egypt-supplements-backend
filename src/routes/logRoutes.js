import express from "express";
import { z } from "zod";
import Log, { LOG_TYPES } from "../models/logModel.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { logEvent } from "../utils/logger.js";
import { clientIp, hit } from "../utils/rateLimit.js";

const router = express.Router();

// ---------------------------- Admin: read the activity log ----------------------------
router.get("/admin", protect, admin, async (req, res) => {
  const pageSize = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);
  const query = LOG_TYPES.includes(req.query.type) ? { type: req.query.type } : {};

  const [logs, total, errorsLastDay] = await Promise.all([
    Log.find(query).sort({ createdAt: -1 }).skip(pageSize * (page - 1)).limit(pageSize).lean(),
    Log.countDocuments(query),
    Log.countDocuments({ type: "error", createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
  ]);
  res.status(200).json({ logs, page, pages: Math.max(1, Math.ceil(total / pageSize)), total, errorsLastDay });
});

// ---------------------------- Public: the website reports a crash ----------------------------
// When a page crashes in a visitor's browser, the site sends a short note
// here so it shows up in the log. Limited per visitor so it can't be flooded.
const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(300),
  page: z.string().trim().max(300).optional().default(""),
  stack: z.string().max(1500).optional().default(""),
});

router.post("/client-error", validate(clientErrorSchema), async (req, res) => {
  const counter = await hit(`client-error:${clientIp(req)}`, 60 * 60 * 1000);
  if (!counter || counter.count <= 20) {
    await logEvent("error", `Website crashed on ${req.body.page || "a page"}: ${req.body.message}`, {
      details: { page: req.body.page, stack: req.body.stack, browser: String(req.headers["user-agent"] || "").slice(0, 200) },
    });
  }
  res.status(204).end();
});

export default router;
