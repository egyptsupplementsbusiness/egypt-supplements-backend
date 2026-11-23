import express from "express";
import {
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "../controllers/categoryController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createCategorySchema, updateCategorySchema, reorderSchema } from "../middleware/categoryValidator.js";

const router = express.Router();

// Public
router.get("/", getPublicCategories);

// Admin
router.get("/admin", protect, admin, getAdminCategories);
router.post("/admin", protect, admin, validate(createCategorySchema), createCategory);
router.put("/admin/reorder", protect, admin, validate(reorderSchema), reorderCategories);
router.patch("/admin/:id", protect, admin, validate(updateCategorySchema), updateCategory);
router.delete("/admin/:id", protect, admin, deleteCategory);

export default router;
