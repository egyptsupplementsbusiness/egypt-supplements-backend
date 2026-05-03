import express from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------------------------- Public Routes ----------------------------
router.post("/register", registerUser);
router.post("/login", loginUser);

// ---------------------------- Protected User Routes (Self-Service) ----------------------------
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);
router.put("/profile/password", protect, updateUserPassword);

// ---------------------------- Protected Admin Routes ----------------------------
router.get("/admin", protect, admin, getUsers);
router.get("/admin/:id", protect, admin, getUserById);
router.patch("/admin/:id", protect, admin, updateUser);
router.delete("/admin/:id", protect, admin, deleteUser);

export default router;
