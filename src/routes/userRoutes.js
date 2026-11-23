import express from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  updateUserEmail,
  deactivateMyAccount,
  forgotPassword,
  getResetRequests,
  resolveResetRequest,
  adminSetUserPassword,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserAnalytics,
} from "../controllers/userController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updatePasswordSchema,
  updateEmailSchema,
  confirmPasswordSchema,
  forgotPasswordSchema,
  adminSetPasswordSchema,
  adminUpdateUserSchema,
} from "../middleware/userValidator.js";

const router = express.Router();

// ---------------------------- Public Routes ----------------------------
router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

// ---------------------------- Protected User Routes (Self-Service) ----------------------------
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, validate(updateProfileSchema), updateUserProfile);
router.put("/profile/password", protect, validate(updatePasswordSchema), updateUserPassword);
router.put("/profile/email", protect, validate(updateEmailSchema), updateUserEmail);
router.post("/profile/close", protect, validate(confirmPasswordSchema), deactivateMyAccount);

// ---------------------------- Protected Admin Routes ----------------------------
router.get("/admin", protect, admin, getUsers);
router.get("/admin/analytics", protect, admin, getUserAnalytics);
// Password-help requests from the "Forgot password" form
router.get("/admin/reset-requests", protect, admin, getResetRequests);
router.patch("/admin/reset-requests/:id/resolve", protect, admin, resolveResetRequest);
router.get("/admin/:id", protect, admin, getUserById);
router.patch("/admin/:id", protect, admin, validate(adminUpdateUserSchema), updateUser);
router.put("/admin/:id/password", protect, admin, validate(adminSetPasswordSchema), adminSetUserPassword);
router.delete("/admin/:id", protect, admin, deleteUser);

export default router;