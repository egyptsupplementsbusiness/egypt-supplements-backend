import mongoose from "mongoose";

// ---------------------------- Variant Schema ----------------------------
const variantSchema = new mongoose.Schema({
  flavor: {
    type: String,
    default: "",
  },
  size: {
    type: String,
    default: "",
  },
  servings: {
    type: String,
    default: "", // Changed from null to an empty string
    // REMOVED: min: [0, ...] because strings don't use 'min' in Mongoose
  },
  price: {
    type: Number,
    required: [true, "Please add a price"],
    min: [0, "Price cannot be negative"],
  },
  discountedPrice: {
    type: Number,
    default: null,
    min: [0, "Discounted price cannot be negative"],
  },
  countInStock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, "Stock cannot be negative"],
  },
  sku: {
    type: String,
    default: "",
  },
});

// A sale price, when set, must be above 0 and below the normal price.
// Empty (null) means the option is not on sale.
variantSchema.pre("validate", function () {
  if (this.discountedPrice === undefined || this.discountedPrice === null) return;
  if (!(this.discountedPrice > 0) || this.discountedPrice >= this.price) {
    this.invalidate(
      "discountedPrice",
      `The sale price (${this.discountedPrice}) must be lower than the normal price (${this.price}) and above 0.`,
    );
  }
});

// ---------------------------- Main Product Schema ----------------------------
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a product name"],
      trim: true,
    },
    brand: {
      type: String,
      default: "", // optional
    },
    // The category this product belongs to, by its id. The id never changes,
    // so renaming a category can't separate it from its products.
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    // A copy of that category's slug (e.g. "mass-gain"), kept in step by the
    // server, for links and old clients. Never set it by hand.
    category: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      maxLength: [200, "Summary cannot exceed 200 characters"],
      default: "",
    },
    details: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      required: [true, "Please add an image link"],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    variants: [variantSchema],
  },
  {
    timestamps: true,
  },
);

// Indexes to keep listing, filtering and search fast as the catalogue grows.
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ name: 1 });
// Duplicate detection looks a product up by name + brand together
productSchema.index({ name: 1, brand: 1 });
// Speeds up the "lowest stock first" sort and low-stock lookups
productSchema.index({ "variants.countInStock": 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
