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
import { cleanupOrphanImages } from "./utils/cloudinaryUtils.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Vercel (and Railway) sit in front of the app, so read the visitor's real
// address from the proxy headers. Needed for login limits later.
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
app.use(morgan("dev"));

// ---------------------------- Base Routes ----------------------------
app.get("/api/status", (req, res) => {
  const database = isDbConnected() ? "connected" : "disconnected";
  res.status(database === "connected" ? 200 : 503).json({
    status: database === "connected" ? "success" : "degraded",
    database,
  });
});

// ---------------------------- Daily image clean-up (Vercel Cron) ----------------------------
// Vercel calls this once a day (see vercel.json) and sends
// "Authorization: Bearer <CRON_SECRET>". Without the right secret it does nothing.
app.get("/api/cron/image-cleanup", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: "Not allowed" });
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    return res.status(200).json({ skipped: "Cloudinary is not set up" });
  }
  const summary = await cleanupOrphanImages();
  console.log("🧹 Image cleanup:", JSON.stringify(summary));
  res.status(200).json(summary);
});

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
