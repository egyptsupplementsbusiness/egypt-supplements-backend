import Category, { slugify } from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import { destroyImageIfUnused } from "../utils/cloudinaryUtils.js";
import { logEvent } from "../utils/logger.js";

// Count products per category (by id), so the admin sees how many are in each one.
const countsById = async () => {
  const rows = await Product.aggregate([{ $group: { _id: "$categoryId", count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.filter((r) => r._id).map((r) => [String(r._id), r.count]));
};

// ---------------------------- Public ----------------------------
// Visible categories for the home page, in order.
export const getPublicCategories = async (req, res) => {
  const categories = await Category.find({ isVisible: true })
    .sort({ order: 1, name: 1 })
    .select("name nameAr slug image description");
  res.status(200).json({ categories });
};

// ---------------------------- Admin ----------------------------
export const getAdminCategories = async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }),
    countsById(),
  ]);
  res.status(200).json({
    categories: categories.map((c) => ({ ...c.toObject(), productCount: counts[String(c._id)] || 0 })),
  });
};

export const createCategory = async (req, res) => {
  const { name, nameAr = "", description, image = "", isVisible = true } = req.body;
  const slug = slugify(name);
  if (!slug) {
    res.status(400);
    throw new Error("Please enter a category name");
  }

  if (await Category.exists({ slug })) {
    res.status(409);
    throw new Error("A category with this name already exists");
  }

  const last = await Category.findOne().sort({ order: -1 }).select("order");
  const category = await Category.create({
    name: name.trim(),
    nameAr,
    description: description || { en: "", ar: "" },
    slug,
    image,
    isVisible,
    order: (last?.order || 0) + 1,
  });

  await logEvent("admin", `Added category "${category.name}"`, { user: req.user });
  res.status(201).json({ message: "Category created", category });
};

export const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const oldSlug = category.slug;
  const oldImage = category.image;

  if (req.body.name !== undefined) {
    const newSlug = slugify(req.body.name);
    if (!newSlug) {
      res.status(400);
      throw new Error("Please enter a category name");
    }
    if (newSlug !== oldSlug && (await Category.exists({ slug: newSlug }))) {
      res.status(409);
      throw new Error("A category with this name already exists");
    }
    category.name = req.body.name.trim();
    category.slug = newSlug;
  }
  if (req.body.nameAr !== undefined) category.nameAr = req.body.nameAr;
  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.image !== undefined) category.image = req.body.image;
  if (req.body.isVisible !== undefined) category.isVisible = req.body.isVisible;
  if (req.body.order !== undefined) category.order = req.body.order;

  const saved = await category.save();

  // Products are linked by the category's id, so they stay in it. Only their
  // copy of the slug (used in links) needs refreshing.
  if (saved.slug !== oldSlug) {
    await Product.updateMany({ categoryId: saved._id }, { $set: { category: saved.slug } });
  }

  // A replaced image's old file can go
  if (req.body.image !== undefined && oldImage && oldImage !== saved.image) {
    await destroyImageIfUnused(oldImage);
  }

  const what = [
    saved.slug !== oldSlug && `renamed to "${saved.name}"`,
    req.body.image !== undefined && oldImage !== saved.image && "photo changed",
    req.body.isVisible !== undefined && (saved.isVisible ? "shown on the site" : "hidden from the site"),
  ].filter(Boolean);
  if (what.length) await logEvent("admin", `Category "${saved.name}": ${what.join(", ")}`, { user: req.user });
  res.status(200).json({ message: "Category updated", category: saved });
};

// Reassign the category's products, then delete it. The products are moved to
// "others" (or left uncategorised if "others" was the one deleted).
export const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const moveTo = req.query.moveTo ? slugify(req.query.moveTo) : "others";
  const fallback = moveTo && moveTo !== category.slug ? await Category.findOne({ slug: moveTo }) : null;

  await Product.updateMany(
    { categoryId: category._id },
    { $set: { categoryId: fallback?._id || null, category: fallback?.slug || "" } },
  );

  const image = category.image;
  await category.deleteOne();
  if (image) await destroyImageIfUnused(image);

  await logEvent("admin", `Deleted category "${category.name}"${fallback ? ` (products moved to ${fallback.name})` : ""}`, {
    user: req.user,
  });
  res.status(200).json({ message: "Category deleted", movedTo: fallback?.slug || null });
};

// Save a new order for the category tiles in one call (drag to reorder).
export const reorderCategories = async (req, res) => {
  const { ids } = req.body; // array of category ids, in the new order
  await Promise.all(ids.map((id, index) => Category.updateOne({ _id: id }, { $set: { order: index + 1 } })));
  const categories = await Category.find().sort({ order: 1, name: 1 });
  await logEvent("admin", "Changed the order of the categories", { user: req.user });
  res.status(200).json({ message: "Order saved", categories });
};
