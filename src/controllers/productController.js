import Product from "../models/productModel.js";

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
      const matchingVariantIndex = existingProduct.variants.findIndex(
        (existingVar) =>
          existingVar.flavor === incomingVariant.flavor &&
          existingVar.size === incomingVariant.size &&
          existingVar.servings === incomingVariant.servings,
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

  // NEW: Featured Items Only
  const featuredFilter =
    req.query.featured === "true" ? { isFeatured: true } : {};

  // NEW: In-Stock Items Only (Checks if ANY variant has stock > 0)
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
    sortObject = { "variants.price": 1 }; // Price: Low to High (1 is ascending)
  } else if (req.query.sort === "highest") {
    sortObject = { "variants.price": -1 }; // Price: High to Low (-1 is descending)
  }

  // 5. Fetch the data
  const count = await Product.countDocuments(query);

  const products = await Product.find(query)
    .sort(sortObject) // Pass the dynamic sort object here
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
    product.name = req.body.name || product.name;
    product.brand = req.body.brand || product.brand;
    product.category = req.body.category || product.category;
    product.summary = req.body.summary || product.summary;
    product.details = req.body.details || product.details;
    product.image = req.body.image || product.image;
    product.isFeatured =
      req.body.isFeatured !== undefined
        ? req.body.isFeatured
        : product.isFeatured;

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
    await product.deleteOne();
    res.status(200).json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
};
