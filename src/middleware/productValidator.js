import { z } from "zod";

// NOTE: validate() replaces req.body with the parsed result, so every field a
// route needs must be listed here (unknown fields are stripped).

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const variantFields = {
  // Keep each option's id when editing, so carts and orders that point
  // at a specific flavor/size keep working after the product is saved
  _id: objectId.optional(),
  flavor: z.string().trim().max(60, "Flavor is too long (60 letters at most)").optional(),
  size: z.string().trim().max(60, "Size is too long (60 letters at most)").optional(),
  servings: z.string().trim().max(20, "Servings is too long").optional(),
  price: z.number().positive("Price must be greater than 0").max(1000000, "That price is too high"),
  discountedPrice: z
    .number()
    .nonnegative("Discounted price cannot be negative")
    .nullable()
    .optional(),
  countInStock: z
    .number()
    .int("Stock must be a whole number")
    .nonnegative("Stock cannot be negative")
    .max(100000, "That stock number is too high"),
  sku: z.string().trim().max(60, "Product code is too long (60 letters at most)").optional(),
};

export const productSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(120, "Name is too long (120 letters at most)"),
  brand: z.string().trim().max(60, "Brand is too long (60 letters at most)").optional().default(""),
  // Pick the category by its id (the admin form does). A category name is
  // still accepted from older clients, but it must be an existing category.
  categoryId: objectId.optional(),
  category: z.string().trim().optional(),
  summary: z.string().max(200, "Summary is too long").optional(),
  details: z.string().max(5000, "Full description is too long (5000 letters at most)").optional(),
  image: z.string().url("Invalid image URL").max(400),
  isFeatured: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  variants: z
    .array(z.object(variantFields))
    .min(1, "At least one variant is required")
    .max(40, "Too many options (40 at most)"),
});

// Editing sends only what the admin changed:
// - top-level fields that changed
// - variants: options that changed (with _id, only the changed fields) and
//   new options (no _id, all fields)
// - removeVariantIds: options the admin deleted
// - seen: the values the admin was looking at for each changed field, so the
//   server can warn when someone else (or a new order) changed them meanwhile
// - force: save anyway after that warning
export const updateProductSchema = z.object({
  name: productSchema.shape.name.optional(),
  brand: z.string().trim().max(60, "Brand is too long (60 letters at most)").optional(),
  categoryId: objectId.optional(),
  category: z.string().trim().optional(),
  summary: productSchema.shape.summary,
  details: productSchema.shape.details,
  image: productSchema.shape.image.optional(),
  isFeatured: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        ...variantFields,
        price: variantFields.price.optional(),
        countInStock: variantFields.countInStock.optional(),
      }),
    )
    .optional(),
  removeVariantIds: z.array(objectId).optional(),
  seen: z
    .object({
      fields: z.record(z.string(), z.any()).optional(),
      variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  force: z.boolean().optional(),
});
