import express from "express";
import {
  getShopSettings,
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  getAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
  getOrderSummary,
  getSalesReport,
} from "../controllers/orderController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { createOrderSchema, updateOrderStatusSchema } from "../middleware/orderValidator.js";

const router = express.Router();

// ---------------------------- Public ----------------------------
router.get("/settings", getShopSettings);

// ---------------------------- Admin ----------------------------
// Placed before "/:id" style routes so "admin" is never read as an id
router.get("/admin/summary", protect, admin, getOrderSummary);
router.get("/admin/report", protect, admin, getSalesReport);
router.get("/admin", protect, admin, getAllOrders);
router.get("/admin/:id", protect, admin, getOrderByIdAdmin);
router.patch("/admin/:id/status", protect, admin, validate(updateOrderStatusSchema), updateOrderStatus);

// ---------------------------- Customer ----------------------------
router.post("/", protect, validate(createOrderSchema), createOrder);
router.get("/mine", protect, getMyOrders);
router.get("/mine/:id", protect, getMyOrderById);
router.patch("/mine/:id/cancel", protect, cancelMyOrder);

export default router;
