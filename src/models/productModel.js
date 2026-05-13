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
      required: [true, "Please add a brand"],
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
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

const Product = mongoose.model("Product", productSchema);

export default Product;
