import Product from "../models/productModel.js";
import Category, { slugify } from "../models/categoryModel.js";

// "mass-gain" -> "Mass Gain"
const nameFromSlug = (slug) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Products used to point at their category by its name. Now they point at it
 * by the category's id (categoryId), which never changes when the category is
 * renamed. This links every product that has no categoryId yet to the
 * matching category. If a product names a category that doesn't exist, that
 * category is created, so no product drops out of the shop.
 *
 * Safe to run any number of times: products already linked are skipped.
 */
export const migrateProductCategories = async () => {
  const todo = await Product.find(
    { categoryId: null, category: { $nin: ["", null] } },
    { category: 1 },
  ).lean();
  if (todo.length === 0) return { linked: 0, createdCategories: 0 };

  // Group the products by the category they name
  const bySlug = new Map();
  for (const product of todo) {
    const slug = slugify(product.category);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(product._id);
  }

  let linked = 0;
  let createdCategories = 0;
  for (const [slug, ids] of bySlug) {
    let category = await Category.findOne({ slug });
    if (!category) {
      const last = await Category.findOne().sort({ order: -1 }).select("order");
      try {
        category = await Category.create({ name: nameFromSlug(slug), slug, order: (last?.order || 0) + 1 });
        createdCategories += 1;
      } catch (error) {
        // Another copy of the app created it at the same moment
        if (error.code !== 11000) throw error;
        category = await Category.findOne({ slug });
      }
    }
    const result = await Product.updateMany(
      { _id: { $in: ids }, categoryId: null },
      { $set: { categoryId: category._id, category: category.slug } },
    );
    linked += result.modifiedCount;
  }

  console.log(`🏷️  Linked ${linked} product(s) to their category by id${createdCategories ? `, created ${createdCategories} missing categor${createdCategories === 1 ? "y" : "ies"}` : ""}`);
  return { linked, createdCategories };
};
