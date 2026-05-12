import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  getAdminProducts, // <-- New Import
  getAdminProductById, // <-- New Import
} from "../controllers/productController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  productSchema,
  updateProductSchema,
} from "../middleware/productValidator.js";

const router = express.Router();

// ---------------------------- Admin Routes ----------------------------
// Placed at the top so Express doesn't confuse "admin" for an ID parameter
router.get("/admin/all", protect, admin, getAdminProducts);
router.get("/admin/:id", protect, admin, getAdminProductById);

router.post("/add", protect, admin, validate(productSchema), createProduct);
router.patch(
  "/edit/:id",
  protect,
  admin,
  validate(updateProductSchema),
  updateProduct,
);
router.delete("/delete/:id", protect, admin, deleteProduct);

// ---------------------------- Public Routes ----------------------------
router.get("/", getProducts);
router.get("/:id", getProductById);

export default router;
