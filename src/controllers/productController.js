import Product from "../models/productModel.js";
import Order from "../models/orderModel.js";
import { LOW_STOCK_THRESHOLD } from "../config/constants.js";
import { destroyImageIfUnused } from "../utils/cloudinaryUtils.js";

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
    { "variants.flavor": regex },
  ];
  if (includeSku) fields.push({ "variants.sku": regex });
  return { $or: fields };
};

// ---------------------------- Public view of a product ----------------------------
// The public never sees exact stock numbers. Each option reports only whether
// it's in stock, plus "X left" when it's running low (to nudge a sale).
const publicVariant = (variant) => {
  const stock = variant.countInStock || 0;
  const low = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  return {
    _id: variant._id,
    flavor: variant.flavor,
    size: variant.size,
    servings: variant.servings,
    price: variant.price,
    inStock: stock > 0,
    lowStock: low,
    ...(low ? { remaining: stock } : {}),
  };
};

const publicProduct = (product) => {
  const p = typeof product.toObject === "function" ? product.toObject() : product;
  return {
    _id: p._id,
    name: p.name,
    brand: p.brand,
    category: p.category,
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
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);

  if (brands.length === 0) return {};
  return brands.length === 1 ? { brand: brands[0] } : { brand: { $in: brands } };
};

// Category filter: treats "-" and spaces as the same, so the URL slug
// "pre-workout" matches "pre-workout" or "pre workout" in the database
const buildCategoryFilter = (rawCategory) => {
  if (typeof rawCategory !== "string") return {};
  const words = rawCategory
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return {};
  const pattern = `^${words.map(escapeRegex).join("[\\s-]+")}$`;
  return { category: { $regex: pattern, $options: "i" } };
};

const normalizeText = (value = "") => String(value ?? "").trim().toLowerCase();

// ---------------------------- Create / Append Product (Admin) ----------------------------
export const createProduct = async (req, res) => {
  const {
    name,
    brand,
    category,
    summary,
    details,
    image,
    isFeatured,
    variants,
  } = req.body;

  if (!variants || variants.length === 0) {
    res.status(400);
    throw new Error(
      "No product variants provided. You must add at least one price/stock entry.",
    );
  }

  // 1. Normalize strings to prevent case-sensitive duplicates
  const normalizedName = normalizeText(name);
  const normalizedBrand = normalizeText(brand);
  const normalizedCategory = normalizeText(category);

  // 2. Warn (don't merge) if a product with the same name, brand and category
  // already exists, so the admin decides what to do.
  const existingProduct = await Product.findOne({
    name: normalizedName,
    brand: normalizedBrand,
    category: normalizedCategory,
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
    category: normalizedCategory,
    summary,
    details,
    image,
    isFeatured,
    variants,
  });

  const createdProduct = await product.save();

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
  const categoryFilter = buildCategoryFilter(req.query.category);
  // In stock = at least one variant has stock
  const inStockFilter =
    req.query.inStock === "true" ? { "variants.countInStock": { $gt: 0 } } : {};
  // Out of stock = NO variant has stock (uses a different key, so both can't clash)
  const outOfStockFilter =
    req.query.outOfStock === "true"
      ? { variants: { $not: { $elemMatch: { countInStock: { $gt: 0 } } } } }
      : {};

  const query = {
    ...keyword,
    ...brandFilter,
    ...categoryFilter,
    ...inStockFilter,
    ...outOfStockFilter,
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
  const categoryFilter = buildCategoryFilter(req.query.category);

  const featuredFilter =
    req.query.featured === "true" ? { isFeatured: true } : {};

  const inStockFilter =
    req.query.inStock === "true" ? { "variants.countInStock": { $gt: 0 } } : {};

  // Combine all queries and filters into one master object
  const query = {
    ...keyword,
    ...brandFilter,
    ...categoryFilter,
    ...featuredFilter,
    ...inStockFilter,
  };

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
    .skip(pageSize * (page - 1));

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
  const product = await Product.findById(req.params.id);

  if (product) {
    res.status(200).json(publicProduct(product));
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Update Product (Admin) ----------------------------
export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Remember the old image so we can delete it AFTER the save succeeds
    const oldImage = product.image;
    const imageChanged = Boolean(req.body.image) && req.body.image !== oldImage;

    // Update standard fields (stored lowercase, same as createProduct, so
    // duplicate detection and filters keep working after an edit)
    if (req.body.name) product.name = normalizeText(req.body.name);
    if (req.body.brand !== undefined) product.brand = normalizeText(req.body.brand);
    if (req.body.category) product.category = normalizeText(req.body.category);

    // Use !== undefined so these can be cleared to an empty string
    if (req.body.summary !== undefined) product.summary = req.body.summary;
    if (req.body.details !== undefined) product.details = req.body.details;
    if (req.body.image) product.image = req.body.image;

    // Handle booleans safely
    product.isFeatured =
      req.body.isFeatured !== undefined
        ? req.body.isFeatured
        : product.isFeatured;

    // Handle arrays safely
    if (req.body.variants) {
      product.variants = req.body.variants;
    }

    const updatedProduct = await product.save();

    // Only now that the new image is saved, delete the old one from Cloudinary
    // (skipped if another product happens to use the same image)
    if (imageChanged) {
      await destroyImageIfUnused(oldImage, { excludeProductId: product._id });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
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

    res.status(200).json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Get Filters & Metadata (Public) ----------------------------
// Public-safe: categories, brands and the number of products. No stock totals.
export const getFiltersMetadata = async (req, res) => {
  const [categories, brands, totalProducts] = await Promise.all([
    Product.distinct("category"),
    Product.distinct("brand", { brand: { $nin: ["", null] } }),
    Product.countDocuments(),
  ]);

  res.status(200).json({
    categories: { count: categories.length, names: categories },
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
