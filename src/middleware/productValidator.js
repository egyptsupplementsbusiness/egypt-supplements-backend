import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  brand: z.string().min(2, "Brand is required"),
  category: z.string().min(2, "Category is required"),
  summary: z.string().max(200, "Summary is too long").optional(),
  details: z.string().optional(),
  image: z.string().url("Invalid image URL"),
  isFeatured: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        flavor: z.string().optional(),
        size: z.string().optional(),

        // ADDED .optional() HERE: Now it happily accepts undefined if omitted
        servings: z.number().nonnegative().nullable().optional(),

        price: z.number().positive("Price must be greater than 0"),
        discountedPrice: z.number().nonnegative().nullable().optional(),
        countInStock: z.number().int().nonnegative(),
        sku: z.string().optional(),
      }),
    )
    .min(1, "At least one variant is required"),
});

export const updateProductSchema = productSchema.partial();
