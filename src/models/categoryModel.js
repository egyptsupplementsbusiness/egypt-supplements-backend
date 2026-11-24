import mongoose from "mongoose";

// A shop category shown on the home page and used to group products.
// The product's own "category" field stores the category's slug.

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // shown as typed, e.g. "Mass Gain"
    nameAr: { type: String, default: "", trim: true }, // Arabic name, e.g. "زيادة الوزن" (empty = use name)
    // One line shown on the home page tile, in both languages (empty = built-in line)
    description: {
      en: { type: String, default: "", trim: true },
      ar: { type: String, default: "", trim: true },
    },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. "mass-gain"
    image: { type: String, default: "" }, // optional photo; a built-in design is used when empty
    order: { type: Number, default: 0 }, // smaller shows first
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ order: 1, name: 1 });
// Public home page lists only visible categories in order
categorySchema.index({ isVisible: 1, order: 1 });

/** "Mass Gain" -> "mass-gain" */
export const slugify = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const Category = mongoose.model("Category", categorySchema);

// The four categories the shop starts with (only seeded when none exist yet).
export const DEFAULT_CATEGORIES = [
  { name: "Creatine", slug: "creatine", order: 1 },
  { name: "Mass Gain", slug: "mass-gain", order: 2 },
  { name: "Pre-Workout", slug: "pre-workout", order: 3 },
  { name: "Others", slug: "others", order: 4 },
];

export const seedCategories = async () => {
  const count = await Category.estimatedDocumentCount();
  if (count > 0) return;
  await Category.insertMany(DEFAULT_CATEGORIES);
  console.log("🏷️  Seeded the 4 starter categories");
};

export default Category;
