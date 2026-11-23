import { z } from "zod";

// Egyptian mobile: 01 + 9 digits (010, 011, 012, 015). Spaces, dashes and a
// +20 / 20 country code are accepted and normalised to 01XXXXXXXXX.
const egyptianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+?20)/, "0"))
  .refine((v) => /^01[0125]\d{8}$/.test(v), "Please enter a valid Egyptian mobile number, e.g. 01012345678");

const savedAddressSchema = z
  .object({
    governorate: z.string().trim().max(40).optional(),
    city: z.string().trim().max(60).optional(),
    street: z.string().trim().max(150).optional(),
    building: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .optional();

// NOTE: validate() replaces req.body with the parsed result, so every field a
// route needs must be listed in its schema (unknown fields are stripped).

// 1. Register Schema
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: egyptianMobile,
});

// 2. Login Schema
export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  // We don't check for min length here; we just need to ensure they sent *something*
  password: z.string().min(1, "Password is required"),
});

// 3. Update Profile Schema (User self-service)
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  phone: egyptianMobile.optional(),
  address: z.string().trim().max(300, "Address is too long").optional(),
  savedAddress: savedAddressSchema,
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

// 4b. Change Email (needs the current password)
export const updateEmailSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(1, "Please enter your password to confirm"),
});

// 4c. Confirm with password only (used to close an account)
export const confirmPasswordSchema = z.object({
  password: z.string().min(1, "Please enter your password to confirm"),
});

// 4d. Forgot password (public)
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
});

// 4e. Admin sets a customer's password
export const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// 5. Admin Update User Schema
export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().email("Please provide a valid email address").optional(),
  phone: z.string().trim().min(8, "Please provide a valid phone number").optional(),
  role: z
    .enum(["user", "admin"], {
      message: "Role must be either 'user' or 'admin'",
    })
    .optional(),
  isActive: z.boolean({ message: "isActive must be true or false" }).optional(),
});
