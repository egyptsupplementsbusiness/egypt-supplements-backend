// Shop-wide settings used when an order is placed. The website reads these
// from GET /api/orders/settings, so change them here only.
export const SHOP_SETTINGS = {
  currency: "EGP",
  shippingFee: Number(process.env.SHIPPING_FEE) || 50,
  freeShippingThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD) || 2000,
  // Most of one item a customer can order at once
  maxQtyPerItem: 10,
};
