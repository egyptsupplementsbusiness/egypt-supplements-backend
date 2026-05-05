import { z } from "zod";

// 1. Register Schema
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  // Egyptian numbers are typically 11 digits, but we keep it slightly flexible for international formats like +20
  phone: z.string().min(8, "Please provide a valid phone number"), 
});

// 2. Login Schema
export const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  // We don't check for min length here; we just need to ensure they sent *something*
  password: z.string().min(1, "Password is required"), 
});

// 3. Update Profile Schema (User self-service)
export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().min(8, "Please provide a valid phone number").optional(),
  // We strictly forbid these fields from being passed in this specific route
  role: z.never({ message: "You cannot update your role here" }).optional(),
  email: z.never({ message: "You cannot update your email here" }).optional(),
  password: z.never({ message: "You cannot update your password here" }).optional(),
});

// 4. Update Password Schema
export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// 5. Admin Update User Schema
export const adminUpdateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Please provide a valid email address").optional(),
  phone: z.string().min(8, "Please provide a valid phone number").optional(),
  role: z.enum(["user", "admin"], {
    errorMap: () => ({ message: "Role must be either 'user' or 'admin'" }),
  }).optional(),
});