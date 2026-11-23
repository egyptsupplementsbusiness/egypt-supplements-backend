// Load .env before anything else reads process.env
import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { scheduleImageCleanup } from "./utils/cloudinaryUtils.js";
import { seedCategories } from "./models/categoryModel.js";
import { getSettings } from "./models/settingsModel.js";

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing settings in .env: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    // Wait for the database first, so the site never gets "500" errors
    // just because the server started before MongoDB was ready
    await connectDB();
  } catch {
    process.exit(1);
  }

  // First-run setup: create the settings document and the 4 starter
  // categories if they aren't there yet. Never blocks start-up.
  try {
    await getSettings();
    await seedCategories();
  } catch (error) {
    console.error("Setup (settings/categories) failed:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`);
  });

  scheduleImageCleanup();
};

start();
