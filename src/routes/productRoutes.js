import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
} from "../controllers/productController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  productSchema,
  updateProductSchema,
} from "../middleware/productValidator.js";

const router = express.Router();

// ---------------------------- Admin Routes ----------------------------
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
