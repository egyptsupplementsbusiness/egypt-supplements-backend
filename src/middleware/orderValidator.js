import { z } from "zod";
import { MAX_QTY_PER_ITEM } from "../config/constants.js";

const objectId = (label) => z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

// Egyptian mobile: 01 + 9 digits (010, 011, 012, 015). Spaces and dashes are allowed.
const egyptianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+?20)/, "0"))
  .refine((v) => /^01[0125]\d{8}$/.test(v), "Please enter a valid Egyptian mobile number, e.g. 01012345678");

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId("product"),
        variantId: objectId("product option"),
        qty: z
          .number()
          .int("Quantity must be a whole number")
          .min(1, "Quantity must be at least 1")
          .max(MAX_QTY_PER_ITEM, `You can order up to ${MAX_QTY_PER_ITEM} of one item`),
      }),
    )
    .min(1, "Your cart is empty")
    .max(30, "Too many different items in one order"),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(80),
    phone: egyptianMobile,
    governorate: z.string().trim().min(2, "Please choose your governorate").max(40),
    city: z.string().trim().min(2, "Please enter your city or area").max(60),
    street: z.string().trim().min(3, "Please enter your street address").max(150),
    building: z.string().trim().max(100).optional().default(""),
    notes: z.string().trim().max(300).optional().default(""),
  }),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"], {
    message: "Unknown order status",
  }),
});
