import Product from "../models/productModel.js";
import { v2 as cloudinary } from "cloudinary";

// ---------------------------- Helper: Extract Public ID ----------------------------
const extractPublicId = (url) => {
  if (!url) return null;
  try {
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null; // Not a standard Cloudinary URL

    let afterUpload = parts.slice(uploadIndex + 1);

    if (afterUpload[0].startsWith("v") && !isNaN(afterUpload[0].substring(1))) {
      afterUpload.shift();
    }

    const publicIdWithExt = afterUpload.join("/");
    const lastDot = publicIdWithExt.lastIndexOf(".");

    return lastDot !== -1
      ? publicIdWithExt.substring(0, lastDot)
      : publicIdWithExt;
  } catch (error) {
    console.error("Failed to extract Cloudinary public ID", error);
    return null;
  }
};

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
  const normalizedName = name.trim().toLowerCase();
  const normalizedBrand = brand.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();

  // 2. Check if the exact product already exists
  const existingProduct = await Product.findOne({
    name: normalizedName,
    brand: normalizedBrand,
    category: normalizedCategory,
  });

  if (existingProduct) {
    variants.forEach((incomingVariant) => {
      // ==========================================
      // BULLETPROOF VARIANT MATCHING
      // ==========================================
      const matchingVariantIndex = existingProduct.variants.findIndex(
        (existingVar) => {
          // Normalize strings (handles undefined, null, "", and case/spacing differences)
          const dbFlavor = (existingVar.flavor || "").trim().toLowerCase();
          const incFlavor = (incomingVariant.flavor || "").trim().toLowerCase();

          const dbSize = (existingVar.size || "").trim().toLowerCase();
          const incSize = (incomingVariant.size || "").trim().toLowerCase();

          // Normalize numbers (treats undefined and null as the exact same thing)
          const dbServings = existingVar.servings || null;
          const incServings = incomingVariant.servings || null;

          // Check if all 3 match perfectly
          return (
            dbFlavor === incFlavor &&
            dbSize === incSize &&
            dbServings === incServings
          );
        },
      );

      if (matchingVariantIndex > -1) {
        // Accumulate stock and update prices
        existingProduct.variants[matchingVariantIndex].countInStock +=
          incomingVariant.countInStock;
        existingProduct.variants[matchingVariantIndex].price =
          incomingVariant.price;

        if (incomingVariant.discountedPrice !== undefined) {
          existingProduct.variants[matchingVariantIndex].discountedPrice =
            incomingVariant.discountedPrice;
        }
      } else {
        // Push brand new flavor/size
        existingProduct.variants.push(incomingVariant);
      }
    });

    const updatedProduct = await existingProduct.save();

    return res.status(200).json({
      message:
        "Product exists! Inventory updated and new variants added where necessary.",
      product: updatedProduct,
    });
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
  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;

  // 2. Search by Keyword (Name OR SKU for Admins)
  const keyword = req.query.keyword
    ? {
        $or: [
          { name: { $regex: req.query.keyword, $options: "i" } },
          { "variants.sku": { $regex: req.query.keyword, $options: "i" } },
        ],
      }
    : {};

  // 3. Filters (Brand, Category) - Admins usually don't need "inStock" filters
  // because they need to see out-of-stock items, but we can leave the option open.
  const brandFilter = req.query.brand
    ? { brand: req.query.brand.toLowerCase() }
    : {};
  const categoryFilter = req.query.category
    ? { category: req.query.category.toLowerCase() }
    : {};
  const inStockFilter =
    req.query.inStock === "true" ? { "variants.countInStock": { $gt: 0 } } : {};
  const outOfStockFilter =
    req.query.outOfStock === "true"
      ? { "variants.countInStock": { $lte: 0 } }
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
  const pageSize = Number(req.query.limit) || 12;
  const page = Number(req.query.page) || 1;

  // 2. Search by Keyword (Name)
  const keyword = req.query.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: "i",
        },
      }
    : {};

  // 3. Filters (Brand, Category, Featured, In-Stock)
  const brandFilter = req.query.brand
    ? { brand: req.query.brand.toLowerCase() }
    : {};
  const categoryFilter = req.query.category
    ? { category: req.query.category.toLowerCase() }
    : {};

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

  // 6. Send it back to the frontend
  res.status(200).json({
    products,
    page,
    pages: Math.ceil(count / pageSize),
    totalProducts: count,
  });
};

// ---------------------------- Get Single Product (Public) ----------------------------
export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    res.status(200).json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Update Product (Admin) ----------------------------
export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Check if a new image URL is being sent AND if it's different from the old one
    if (req.body.image && req.body.image !== product.image) {
      const oldPublicId = extractPublicId(product.image);

      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId);
          console.log(`Successfully deleted old image: ${oldPublicId}`);
        } catch (error) {
          console.error("Cloudinary deletion error (Update):", error);
          // We log the error but don't throw it, so the DB still updates!
        }
      }
    }

    // Update standard fields
    product.name = req.body.name || product.name;
    product.brand = req.body.brand || product.brand;
    product.category = req.body.category || product.category;
    product.summary = req.body.summary || product.summary;
    product.details = req.body.details || product.details;
    product.image = req.body.image || product.image;

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
    // Delete the image from Cloudinary first
    const publicId = extractPublicId(product.image);

    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Successfully deleted image: ${publicId}`);
      } catch (error) {
        console.error("Cloudinary deletion error (Delete):", error);
      }
    }

    // Then delete from the database
    await product.deleteOne();
    res.status(200).json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};

// ---------------------------- Get Filters & Metadata (Public/Admin) ----------------------------
export const getFiltersMetadata = async (req, res) => {
  try {
    // 1. Fetch unique categories and brands natively from MongoDB
    const categories = await Product.distinct("category");
    const brands = await Product.distinct("brand");

    // 2. Fetch total number of distinct product listings
    const totalProducts = await Product.countDocuments();

    // 3. Aggregate total physical units in stock across ALL variants
    // This digs into every product, looks at every variant array, and sums the countInStock
    const stockData = await Product.aggregate([
      { $unwind: "$variants" },
      {
        $group: {
          _id: null,
          totalPhysicalStock: { $sum: "$variants.countInStock" },
        },
      },
    ]);
    
    const totalPhysicalStock = stockData.length > 0 ? stockData[0].totalPhysicalStock : 0;

    res.status(200).json({
      categories: {
        count: categories.length,
        names: categories, // Array of strings e.g. ["protein", "creatine"]
      },
      brands: {
        count: brands.length,
        names: brands, // Array of strings e.g. ["muscletech", "optimum nutrition"]
      },
      inventory: {
        totalProducts: totalProducts, // Number of distinct products (e.g. 50)
        totalPhysicalStock: totalPhysicalStock, // Number of actual physical tubs/bottles in the warehouse (e.g. 3500)
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error("Failed to fetch metadata: " + error.message);
  }
};