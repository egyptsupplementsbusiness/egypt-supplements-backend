// Vercel entry point. Vercel runs this file for every request (see vercel.json)
// instead of "npm start". Local development still uses src/server.js.
import app from "../src/app.js";
import { connectDBOnce } from "../src/config/db.js";
import { seedCategories } from "../src/models/categoryModel.js";
import { getSettings } from "../src/models/settingsModel.js";
import { migrateProductCategories } from "../src/utils/categoryMigration.js";

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];

// First-run setup (settings document + starter categories), once per copy of
// the app. Never blocks a request if it fails.
let setupDone = false;
const runSetupOnce = async () => {
  if (setupDone) return;
  setupDone = true;
  try {
    await getSettings();
    await seedCategories();
    await migrateProductCategories();
  } catch (error) {
    setupDone = false;
    console.error("Setup (settings/categories) failed:", error.message);
  }
};

export default async function handler(req, res) {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables on Vercel: ${missing.join(", ")}`);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: "The server is not set up yet. Please try again later." }));
  }

  try {
    await connectDBOnce();
    await runSetupOnce();
  } catch {
    // Let the browser read the error (CORS) so the site can show a friendly message
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ message: "The shop is having trouble reaching its database. Please try again in a minute." }),
    );
  }

  return app(req, res);
}
