import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import { isDbConnected } from "./config/db.js";
import { IS_PRODUCTION } from "./config/env.js";
import { cleanupOrphanImages } from "./utils/cloudinaryUtils.js";
import { expireStalePendingOrders } from "./controllers/orderController.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Vercel sits in front of the app, so read the visitor's real
// address from the proxy headers. Used by the sign-in limits.
app.set("trust proxy", 1);

app.use(helmet());

// CORS: set CORS_ORIGINS in .env (comma separated, e.g.
// "http://localhost:5173,https://your-site.vercel.app") to only allow those sites.
// When it's not set, every origin is allowed (same behaviour as before).
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, "")) // "https://x.app/" -> "https://x.app"
  .filter(Boolean);

app.use(
  cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined),
);
app.use(express.json());
// Short one-line request logs on the live site, coloured ones locally
app.use(morgan(IS_PRODUCTION ? "tiny" : "dev"));

// ---------------------------- Base Routes ----------------------------
app.get("/api/status", (req, res) => {
  const database = isDbConnected() ? "connected" : "disconnected";
  res.status(database === "connected" ? 200 : 503).json({
    status: database === "connected" ? "success" : "degraded",
    database,
  });
});

// ---------------------------- Daily jobs (Vercel Cron) ----------------------------
// Vercel calls this once a day (see vercel.json) and sends
// "Authorization: Bearer <CRON_SECRET>". Without the right secret it does nothing.
// 1) cancels orders the shop never confirmed within a week (stock goes back)
// 2) deletes uploaded pictures that nothing uses any more
const runDailyJobs = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: "Not allowed" });
  }

  const summary = {};
  try {
    summary.orders = await expireStalePendingOrders();
  } catch (error) {
    console.error("Daily job: auto-cancel failed:", error);
    summary.orders = { error: error.message };
  }
  try {
    summary.images = process.env.CLOUDINARY_API_SECRET
      ? await cleanupOrphanImages()
      : { skipped: "Cloudinary is not set up" };
  } catch (error) {
    console.error("Daily job: image cleanup failed:", error);
    summary.images = { error: error.message };
  }
  console.log("🗓️  Daily jobs:", JSON.stringify(summary));
  res.status(200).json(summary);
};
app.get("/api/cron/daily", runDailyJobs);
// Older name for the same job, kept so an existing schedule keeps working
app.get("/api/cron/image-cleanup", runDailyJobs);

// ---------------------------- User Routes ----------------------------
app.use("/api/users", userRoutes);

// ---------------------------- Product Routes ----------------------------
app.use("/api/products", productRoutes);

// ---------------------------- Upload Routes ----------------------------
app.use("/api/upload", uploadRoutes);

// ---------------------------- Order Routes ----------------------------
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/categories", categoryRoutes);

// ---------------------------- Global Error Handler ----------------------------
app.use(notFound);
app.use(errorHandler);

export default app;
