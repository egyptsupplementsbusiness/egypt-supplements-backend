import { z } from "zod";

// NOTE: validate() replaces req.body with the parsed result, so every field a
// route needs must be listed here (unknown fields are stripped).

export const productSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  brand: z.string().trim().optional().default(""),
  category: z.string().trim().min(2, "Category is required"),
  summary: z.string().max(200, "Summary is too long").optional(),
  details: z.string().optional(),
  image: z.string().url("Invalid image URL"),
  isFeatured: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        // Keep each option's id when editing, so carts and orders that point
        // at a specific flavor/size keep working after the product is saved
        _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
        flavor: z.string().optional(),
        size: z.string().optional(),
        servings: z.string().optional(),
        price: z.number().positive("Price must be greater than 0"),
        discountedPrice: z
          .number()
          .nonnegative("Discounted price cannot be negative")
          .nullable()
          .optional(),
        countInStock: z
          .number()
          .int("Stock must be a whole number")
          .nonnegative("Stock cannot be negative"),
        sku: z.string().optional(),
      }),
    )
    .min(1, "At least one variant is required"),
});

export const updateProductSchema = productSchema.partial();
