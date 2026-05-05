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
import { validate } from "../middleware/validateMiddleware.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updatePasswordSchema,
  adminUpdateUserSchema,
} from "../middleware/userValidator.js";

const router = express.Router();

// ---------------------------- Public Routes ----------------------------
router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);

// ---------------------------- Protected User Routes (Self-Service) ----------------------------
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, validate(updateProfileSchema), updateUserProfile);
router.put("/profile/password", protect, validate(updatePasswordSchema), updateUserPassword);

// ---------------------------- Protected Admin Routes ----------------------------
router.get("/admin", protect, admin, getUsers);
router.get("/admin/:id", protect, admin, getUserById);
router.patch("/admin/:id", protect, admin, validate(adminUpdateUserSchema), updateUser);
router.delete("/admin/:id", protect, admin, deleteUser);

export default router;