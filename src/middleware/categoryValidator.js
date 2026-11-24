import { z } from "zod";

const description = z
  .object({
    en: z.string().trim().max(160, "Description is too long (160 letters at most)").optional().default(""),
    ar: z.string().trim().max(160, "Description is too long (160 letters at most)").optional().default(""),
  })
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters").max(40),
  nameAr: z.string().trim().max(40).optional().default(""),
  description,
  image: z.string().trim().max(400).optional().default(""),
  isVisible: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters").max(40).optional(),
  nameAr: z.string().trim().max(40).optional(),
  description,
  image: z.string().trim().max(400).optional(),
  isVisible: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id")).min(1).max(100),
});
