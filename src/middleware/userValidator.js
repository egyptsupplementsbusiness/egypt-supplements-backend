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

// New passwords: at least 8 characters. (Older accounts with shorter
// passwords can still sign in; they're asked for 8+ only when they change it.)
const newPassword = (label = "Password") =>
  z.string().min(8, `${label} must be at least 8 characters`).max(100, `${label} is too long`);

const personName = z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long (80 letters at most)");
const emailField = z.string().trim().max(120, "Email is too long").email("Please provide a valid email address");

// NOTE: validate() replaces req.body with the parsed result, so every field a
// route needs must be listed in its schema (unknown fields are stripped).

// 1. Register Schema
export const registerSchema = z.object({
  name: personName,
  email: emailField,
  password: newPassword(),
  phone: egyptianMobile,
});

// 2. Login Schema
export const loginSchema = z.object({
  email: emailField,
  // We don't check for min length here; we just need to ensure they sent *something*
  password: z.string().min(1, "Password is required").max(100),
});

// 3. Update Profile Schema (User self-service)
export const updateProfileSchema = z.object({
  name: personName.optional(),
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
  oldPassword: z.string().min(1, "Old password is required").max(100),
  newPassword: newPassword("New password"),
});

// 4b. Change Email (needs the current password)
export const updateEmailSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Please enter your password to confirm"),
});

// 4c. Confirm with password only (used to close an account)
export const confirmPasswordSchema = z.object({
  password: z.string().min(1, "Please enter your password to confirm"),
});

// 4d. Forgot password (public)
export const forgotPasswordSchema = z.object({
  email: emailField,
});

// 4e. Admin sets a customer's password
export const adminSetPasswordSchema = z.object({
  newPassword: newPassword("New password"),
});

// 5. Admin Update User Schema
export const adminUpdateUserSchema = z.object({
  name: personName.optional(),
  email: emailField.optional(),
  phone: egyptianMobile.optional(),
  role: z
    .enum(["user", "admin"], {
      message: "Role must be either 'user' or 'admin'",
    })
    .optional(),
  isActive: z.boolean({ message: "isActive must be true or false" }).optional(),
});
