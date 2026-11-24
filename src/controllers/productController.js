import Product from "../models/productModel.js";
import Order from "../models/orderModel.js";
import Category, { slugify } from "../models/categoryModel.js";
import { LOW_STOCK_THRESHOLD } from "../config/constants.js";
import { destroyImageIfUnused } from "../utils/cloudinaryUtils.js";
import { logEvent } from "../utils/logger.js";

// ---------------------------- Helpers: Safe Query Filters ----------------------------
// Escape user input before putting it in a $regex (stops errors on "(" and slow regexes)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keyword search. Matches the product name, brand, category and flavors (and
// SKU for admins), so a shopper can search "chocolate" or "pre workout" too.
const buildKeywordFilter = (rawKeyword, includeSku = false) => {
  const keyword = typeof rawKeyword === "string" ? rawKeyword.trim() : "";
  if (!keyword) return {};

  const regex = { $regex: escapeRegex(keyword), $options: "i" };
  const fields = [
    { name: regex },
    { brand: regex },
    { category: regex },
    // Categories are stored as slugs ("pre-workout"), so "pre workout" matches too
    { category: { $regex: escapeRegex(keyword.replace(/\s+/g, "-")), $options: "i" } },
    { "variants.flavor": regex },
  ];
  if (includeSku) fields.push({ "variants.sku": regex });
  return { $or: fields };
};

// ---------------------------- Public view of a product ----------------------------
// The public never sees exact stock numbers. Each option reports only whether
// it's in stock, plus "X left" when it's running low (to nudge a sale).
const onSale = (variant) =>
  typeof variant.discountedPrice === "number" && variant.discountedPrice > 0 && variant.discountedPrice < variant.price;

const publicVariant = (variant) => {
  const stock = variant.countInStock || 0;
  const low = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  return {
    _id: variant._id,
    flavor: variant.flavor,
    size: variant.size,
    servings: variant.servings,
    price: variant.price,
    // Sale price, only when it's a real discount
    discountedPrice: onSale(variant) ? variant.discountedPrice : null,
    inStock: stock > 0,
    lowStock: low,
    ...(low ? { remaining: stock } : {}),
  };
};

const publicProduct = (product) => {
  const p = typeof product.toObject === "function" ? product.toObject() : product;
  // categoryId is filled in with the category itself on the public routes
  const cat = p.categoryId && typeof p.categoryId === "object" && p.categoryId.slug ? p.categoryId : null;
  return {
    _id: p._id,
    name: p.name,
    brand: p.brand,
    category: cat?.slug || p.category,
    categoryName: cat?.name || "",
    categoryNameAr: cat?.nameAr || "",
    categoryId: cat?._id || p.categoryId || null,
    summary: p.summary,
    details: p.details,
    image: p.image,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
    variants: (p.variants || []).map(publicVariant),
    inStock: (p.variants || []).some((v) => (v.countInStock || 0) > 0),
  };
};

// Brand filter: accepts one brand or a comma separated list ("optimum nutrition,muscletech")
const buildBrandFilter = (rawBrand) => {
  if (typeof rawBrand !== "string") return {};
  const brands = rawBrand
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  if (brands.length === 0) return {};
  // Names keep their capitals now, so match "MuscleTech" and "muscletech" alike
  return { brand: { $in: brands.map((b) => new RegExp(`^${escapeRegex(b)}$`, "i")) } };
};

// Category filter. Accepts the URL slug ("pre-workout") or the words
// ("pre workout"), finds that category and filters by its id. Falls back to
// the stored slug for anything not linked yet.
const buildCategoryFilter = async (rawCategory) => {
  if (typeof rawCategory !== "string") return {};
  const words = rawCategory
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return {};
  const category = await Category.findOne({ slug: slugify(words.join(" ")) }).select("_id").lean();
  if (category) return { categoryId: category._id };
  const pattern = `^${words.map(escapeRegex).join("[\\s-]+")}$`;
  return { category: { $regex: pattern, $options: "i" } };
};

// The category a product form picked: by id (the admin form), or by name
// (older clients). It must be one of the shop's categories.
const resolveCategory = async (body, res) => {
  if (body.categoryId) {
    const category = await Category.findById(body.categoryId);
    if (!category) {
      res.status(400);
      throw new Error("That category no longer exists. Please pick another one from the list.");
    }
    return category;
  }
  if (body.category) {
    const category = await Category.findOne({ slug: slugify(body.category) });
    if (!category) {
      res.status(400);
      throw new Error(
        `There's no category called "${body.category}". Please pick one from the list, or add it under Categories first.`,
      );
    }
    return category;
  }
  return null;
};

// Product names and brands are saved as typed (capitals kept), just tidied.
const cleanText = (value = "") => String(value ?? "").trim().replace(/\s+/g, " ");

const exactInsensitive = (text) => new RegExp(`^${escapeRegex(text)}$`, "i");

// Use the spelling of a brand the shop already has ("MuscleTech"), so the
// same brand isn't listed twice with different capitals.
const matchExistingBrand = async (brand) => {
  if (!brand) return "";
  const existing = await Product.findOne({ brand: exactInsensitive(brand) }).select("brand").lean();
  return existing?.brand || brand;
};

// Another product with the same name, brand and category (capitals ignored)
const findDuplicate = ({ name, brand, categoryId, excludeId }) =>
  Product.findOne({
    name: exactInsensitive(name),
    brand: brand ? exactInsensitive(brand) : { $in: ["", null] },
    categoryId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

// Products in hidden categories are left out of the shop's lists and search.
const hiddenCategoryIds = () => Category.find({ isVisible: false }).distinct("_id");

const withoutHiddenCategories = async (rawQuery) => {
  // Products the admin hid one by one
  const query = { ...rawQuery, isHidden: { $ne: true } };
  const hidden = await hiddenCategoryIds();
  if (hidden.length === 0) return query;
  const hiddenSet = new Set(hidden.map(String));
  if (query.categoryId) {
    // Asked for one category: nothing to show if that category is hidden
    return hiddenSet.has(String(query.categoryId)) ? { ...query, categoryId: { $in: [] } } : query;
  }
  return { ...query, categoryId: { $nin: hidden } };
};

// ---------------------------- Create / Append Product (Admin) ----------------------------
export const createProduct = async (req, res) => {
  const {
    name,
    brand,
    summary,
    details,
    image,
    isFeatured,
    isHidden,
    variants,
  } = req.body;

  if (!variants || variants.length === 0) {
    res.status(400);
    throw new Error(
      "No product variants provided. You must add at least one price/stock entry.",
    );
  }

  const category = await resolveCategory(req.body, res);
  if (!category) {
    res.status(400);
    throw new Error("Please pick a category for this product.");
  }

  // 1. Tidy the text (capitals are kept as typed)
  const normalizedName = cleanText(name);
  const normalizedBrand = await matchExistingBrand(cleanText(brand));

  // 2. Warn (don't merge) if a product with the same name, brand and category
  // already exists, so the admin decides what to do.
  const existingProduct = await findDuplicate({
    name: normalizedName,
    brand: normalizedBrand,
    categoryId: category._id,
  });

  if (existingProduct) {
    // Free the image that was just uploaded for this blocked attempt
    if (image && image !== existingProduct.image) {
      await destroyImageIfUnused(image);
    }
    res.status(409);
    throw new Error(
      `A product called "${name}"${normalizedBrand ? ` by ${brand}` : ""} already exists. Edit that one to add stock or options, or use a different name.`,
    );
  }

  // 3. Create fresh product using normalized fields
  const product = new Product({
    name: normalizedName,
    brand: normalizedBrand,
    categoryId: category._id,
    category: category.slug,
    summary,
    details,
    image,
    isFeatured,
    isHidden: Boolean(isHidden),
    variants,
  });

  const createdProduct = await product.save();
  await logEvent("admin", `Added product "${createdProduct.name}"`, { user: req.user });

  res.status(201).json({
    message: "New product created successfully!",
    product: createdProduct,
  });
};

// ---------------------------- Get All Products (Admin) ----------------------------
export const getAdminProducts = async (req, res) => {
  // 1. Pagination Setup (Admins usually prefer denser lists, default to 20)
  const pageSize = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);

  // 2. Search by Keyword (Name OR SKU for Admins)
  const keyword = buildKeywordFilter(req.query.keyword, true);

  // 3. Filters (Brand, Category, Stock)
  const brandFilter = buildBrandFilter(req.query.brand);
  const categoryFilter = await buildCategoryFilter(req.query.category);
  // In stock = at least one variant has stock
  const inStockFilter =
    req.query.inStock === "true" ? { "variants.countInStock": { $gt: 0 } } : {};
  // Out of stock = NO variant has stock (uses a different key, so both can't clash)
  const outOfStockFilter =
    req.query.outOfStock === "true"
      ? { variants: { $not: { $elemMatch: { countInStock: { $gt: 0 } } } } }
      : {};

  const hiddenFilter = req.query.hidden === "true" ? { isHidden: true } : {};

  const query = {
    ...keyword,
    ...brandFilter,
    ...categoryFilter,
    ...inStockFilter,
    ...outOfStockFilter,
    ...hiddenFilter,
  };

  // 4. Dynamic Sorting Setup
  let sortObject = { createdAt: -1 }; // Default: Newest first

  if (req.query.sort === "lowest") {
    sortObject = { "variants.price": 1 };
  } else if (req.query.sort === "highest") {
    sortObject = { "variants.price": -1 };
  } else if (req.query.sort === "stock_lowest") {
    sortObject = { "variants.countInStock": 1 }; // Super useful for admins seeing what to reorder
  }

  // 5. Fetch the data
  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort(sortObject)
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  res.status(200).json({
    products,
    page,
    pages: Math.ceil(count / pageSize),
    totalProducts: count,
  });
};

// ---------------------------- Get Single Product (Admin) ----------------------------
export const getAdminProductById = async (req, res) => {
  // Separated so in the future you can pull in soft-deleted products,
  // supplier data, or cost-basis data that public users shouldn't see.
  const product = await Product.findById(req.params.id);

  if (product) {
    res.status(200).json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Get All Products (Public Catalog) ----------------------------
export const getProducts = async (req, res) => {
  // 1. Pagination Setup
  const pageSize = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);

  // 2. Search by Keyword (Name)
  const keyword = buildKeywordFilter(req.query.keyword);

  // 3. Filters (Brand, Category, Featured, In-Stock)
  const brandFilter = buildBrandFilter(req.query.brand);
  const categoryFilter = await buildCategoryFilter(req.query.category);

  const featuredFilter =
    req.query.featured === "true" ? { isFeatured: true } : {};

  const inStockFilter =
    req.query.inStock === "true" ? { "variants.countInStock": { $gt: 0 } } : {};

  // On sale = at least one option has a sale price
  const saleFilter =
    req.query.onSale === "true" ? { variants: { $elemMatch: { discountedPrice: { $gt: 0 } } } } : {};

  // Combine all queries and filters into one master object
  const query = await withoutHiddenCategories({
    ...keyword,
    ...brandFilter,
    ...categoryFilter,
    ...featuredFilter,
    ...inStockFilter,
    ...saleFilter,
  });

  // 4. Dynamic Sorting Setup
  let sortObject = { createdAt: -1 }; // Default: Newest first

  if (req.query.sort === "lowest") {
    sortObject = { "variants.price": 1 };
  } else if (req.query.sort === "highest") {
    sortObject = { "variants.price": -1 };
  }

  // 5. Fetch the data
  const count = await Product.countDocuments(query);

  const products = await Product.find(query)
    .sort(sortObject)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .populate("categoryId", "name nameAr slug");

  // 6. Send it back to the frontend (stock numbers stripped out)
  res.status(200).json({
    products: products.map(publicProduct),
    page,
    pages: Math.ceil(count / pageSize),
    totalProducts: count,
  });
};

// ---------------------------- Get Single Product (Public) ----------------------------
export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id).populate("categoryId", "name nameAr slug");

  if (product && !product.isHidden) {
    res.status(200).json(publicProduct(product));
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Update Product (Admin) ----------------------------
// Saves only what the admin changed. In particular, stock is only touched for
// the options whose stock the admin actually edited, so orders placed while
// the form was open are never wiped out. If something the admin changed was
// also changed by someone else (or by new orders) since they opened the form,
// nothing is saved and they're asked whether to save anyway.

const FIELD_LABELS = {
  name: "name",
  brand: "brand",
  categoryId: "category",
  summary: "short description",
  details: "full description",
  image: "photo",
  isFeatured: "home page setting",
  isHidden: "shown/hidden in the shop",
};
const VARIANT_FIELD_LABELS = {
  flavor: "flavor",
  size: "size",
  servings: "servings",
  price: "price",
  countInStock: "stock",
  discountedPrice: "sale price",
  sku: "product code",
};
const VARIANT_FIELDS = Object.keys(VARIANT_FIELD_LABELS);

const sameValue = (a, b) => String(a ?? "") === String(b ?? "");

const optionLabel = (variant) =>
  [variant.flavor, variant.size].map((part) => String(part || "").trim()).filter(Boolean).join(" · ") || "this option";

const findConflicts = (product, seen = {}) => {
  const conflicts = [];
  for (const [field, was] of Object.entries(seen.fields || {})) {
    if (!FIELD_LABELS[field]) continue;
    if (!sameValue(product[field], was)) {
      conflicts.push(`The ${FIELD_LABELS[field]} was changed by someone else.`);
    }
  }
  for (const [variantId, fields] of Object.entries(seen.variants || {})) {
    const variant = product.variants.id(variantId);
    if (!variant) {
      conflicts.push("One of the options you changed was deleted by someone else.");
      continue;
    }
    for (const [field, was] of Object.entries(fields || {})) {
      if (!VARIANT_FIELD_LABELS[field] || sameValue(variant[field], was)) continue;
      conflicts.push(
        field === "countInStock"
          ? `Stock of ${optionLabel(variant)} is now ${variant.countInStock}. It was ${was} when you opened this product (new orders or another change since).`
          : `The ${VARIANT_FIELD_LABELS[field]} of ${optionLabel(variant)} was changed by someone else.`,
      );
    }
  }
  return conflicts;
};

// A short plain-words list of what an edit changed, for the activity log
const describeChanges = (product, body) => {
  const parts = [];
  for (const field of Object.keys(FIELD_LABELS)) {
    if (body[field] !== undefined && product.isModified(field)) parts.push(FIELD_LABELS[field]);
  }
  for (const change of body.variants || []) {
    const variant = change._id ? product.variants.id(change._id) : null;
    if (!change._id) {
      parts.push(`new option ${optionLabel(change)}`);
      continue;
    }
    if (!variant) continue;
    for (const field of VARIANT_FIELDS) {
      if (change[field] === undefined) continue;
      parts.push(`${VARIANT_FIELD_LABELS[field]} of ${optionLabel(variant)} to ${change[field] ?? "none"}`);
    }
  }
  if (body.removeVariantIds?.length) parts.push(`removed ${body.removeVariantIds.length} option(s)`);
  return parts.join(", ");
};

export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const body = req.body;

  // 1. Did anything the admin changed also change under them?
  if (!body.force) {
    const conflicts = findConflicts(product, body.seen);
    if (conflicts.length > 0) {
      return res.status(409).json({
        code: "CHANGED_SINCE_OPENED",
        message: "This product was changed while you were editing it.",
        conflicts,
      });
    }
  }

  // Remember the old image so we can delete it AFTER the save succeeds
  const oldImage = product.image;
  const imageChanged = Boolean(body.image) && body.image !== oldImage;

  // 2. Plain fields (stored lowercase, same as createProduct, so duplicate
  // detection and filters keep working after an edit)
  if (body.name) product.name = cleanText(body.name);
  if (body.brand !== undefined) product.brand = await matchExistingBrand(cleanText(body.brand));
  if (body.categoryId || body.category) {
    const category = await resolveCategory(body, res);
    product.categoryId = category._id;
    product.category = category.slug;
  }
  // Use !== undefined so these can be cleared to an empty string
  if (body.summary !== undefined) product.summary = body.summary;
  if (body.details !== undefined) product.details = body.details;
  if (body.image) product.image = body.image;
  if (body.isFeatured !== undefined) product.isFeatured = body.isFeatured;
  if (body.isHidden !== undefined) product.isHidden = body.isHidden;

  // 3. Options: remove, change only the sent fields, add new ones
  for (const id of body.removeVariantIds || []) {
    product.variants.pull(id);
  }
  for (const change of body.variants || []) {
    const existing = change._id ? product.variants.id(change._id) : null;
    if (existing) {
      for (const field of VARIANT_FIELDS) {
        if (change[field] !== undefined) existing[field] = change[field];
      }
      continue;
    }
    if (change._id) continue; // deleted by someone else meanwhile, and the admin chose to save anyway
    if (change.price === undefined || change.countInStock === undefined) {
      res.status(400);
      throw new Error("Each new flavor or size needs a price and a stock number.");
    }
    product.variants.push(change);
  }
  if (product.variants.length === 0) {
    res.status(400);
    throw new Error("A product needs at least one flavor or size with a price.");
  }

  // Renaming (or moving) it must not make it a copy of another product
  if (product.isModified("name") || product.isModified("brand") || product.isModified("categoryId")) {
    const duplicate = await findDuplicate({
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      excludeId: product._id,
    });
    if (duplicate) {
      res.status(409);
      throw new Error(
        `Another product is already called "${duplicate.name}"${duplicate.brand ? ` by ${duplicate.brand}` : ""} in this category. Please use a different name.`,
      );
    }
  }

  const changes = describeChanges(product, body);
  const updatedProduct = await product.save();
  await logEvent("admin", `Edited product "${updatedProduct.name}"${changes ? `: ${changes}` : ""}`, { user: req.user });

  // Only now that the new image is saved, delete the old one from Cloudinary
  // (skipped if another product happens to use the same image)
  if (imageChanged) {
    await destroyImageIfUnused(oldImage, { excludeProductId: product._id });
  }

  res.status(200).json({
    message: "Product updated successfully",
    product: updatedProduct,
  });
};

// ---------------------------- Delete Product (Admin) ----------------------------
export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Mark this product in every past order first, so order history keeps
    // showing the item but flags it as no longer sold.
    await Order.updateMany(
      { "items.product": product._id },
      { $set: { "items.$[it].productDeleted": true } },
      { arrayFilters: [{ "it.product": product._id }] },
    );

    // Remove from the database, then the image. If the image delete fails, the
    // daily sweep picks it up, and the product is never left pointing nowhere.
    const image = product.image;
    await product.deleteOne();
    await destroyImageIfUnused(image);
    await logEvent("admin", `Deleted product "${product.name}"`, { user: req.user });

    res.status(200).json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Get Filters & Metadata (Public) ----------------------------
// Public-safe: categories, brands and the number of products. No stock totals.
export const getFiltersMetadata = async (req, res) => {
  const visible = await withoutHiddenCategories({});
  const [categoryIds, rawBrands, totalProducts] = await Promise.all([
    Product.distinct("categoryId", { categoryId: { $ne: null } }),
    Product.distinct("brand", { ...visible, brand: { $nin: ["", null] } }),
    Product.countDocuments(visible),
  ]);
  // One entry per brand, whatever the capitals
  const brands = [...new Map(rawBrands.map((b) => [b.toLowerCase(), b])).values()];
  // The shop's categories that have products, in the admin's order (hidden
  // ones left out). "items" carries the exact link slug for each.
  const categories = await Category.find({ _id: { $in: categoryIds }, isVisible: true })
    .sort({ order: 1, name: 1 })
    .select("name nameAr slug")
    .lean();

  res.status(200).json({
    categories: {
      count: categories.length,
      names: categories.map((c) => c.name),
      items: categories.map((c) => ({ name: c.name, nameAr: c.nameAr || "", slug: c.slug })),
    },
    brands: { count: brands.length, names: brands },
    inventory: { totalProducts },
  });
};

// ---------------------------- Inventory Stats (Admin only) ----------------------------
// Everything the public version has, plus the real stock figures.
export const getInventoryStats = async (req, res) => {
  const [categories, brands, totalProducts, stockData, lowStock, outOfStock] = await Promise.all([
    Product.distinct("category"),
    Product.distinct("brand", { brand: { $nin: ["", null] } }),
    Product.countDocuments(),
    Product.aggregate([
      { $unwind: "$variants" },
      { $group: { _id: null, totalPhysicalStock: { $sum: "$variants.countInStock" } } },
    ]),
    Product.countDocuments({
      variants: { $elemMatch: { countInStock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } } },
    }),
    Product.countDocuments({ variants: { $not: { $elemMatch: { countInStock: { $gt: 0 } } } } }),
  ]);

  res.status(200).json({
    categories: { count: categories.length, names: categories },
    brands: { count: brands.length, names: brands },
    inventory: {
      totalProducts,
      totalPhysicalStock: stockData[0]?.totalPhysicalStock || 0,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
    },
  });
};
