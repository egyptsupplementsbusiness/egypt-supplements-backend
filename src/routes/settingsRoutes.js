import express from "express";
import { getPublicSettings, getAdminSettings, updateSettings } from "../controllers/settingsController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { updateSettingsSchema } from "../middleware/settingsValidator.js";

const router = express.Router();

// Public: what the website shows
router.get("/", getPublicSettings);

// Admin: read and change everything
router.get("/admin", protect, admin, getAdminSettings);
router.put("/admin", protect, admin, validate(updateSettingsSchema), updateSettings);

export default router;
