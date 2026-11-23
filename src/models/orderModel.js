import mongoose from "mongoose";

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

// A copy of what was bought, at the price it was bought for. Kept even if the
// product is later edited or deleted, so old orders always show correctly.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: "" },
    variantLabel: { type: String, default: "" },
    image: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    // Set when the product is later removed from the shop. The order still
    // shows the item (name, price, image are copied above), just marked.
    productDeleted: { type: Boolean, default: false },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    governorate: { type: String, required: true },
    city: { type: String, required: true },
    street: { type: String, required: true },
    building: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const statusChangeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ["customer", "admin", "system"], default: "system" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "An order needs at least one item"],
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ["cod"], default: "cod" },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    cancelledBy: { type: String, enum: ["customer", "admin", null], default: null },
    statusHistory: { type: [statusChangeSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });
// Sales report groups delivered orders by date; this serves that range scan
orderSchema.index({ status: 1, createdAt: -1 });
// Marking a deleted product across old orders, and "has this been ordered?"
orderSchema.index({ "items.product": 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
