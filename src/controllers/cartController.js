import Cart from "../models/cartModel.js";
import { MAX_QTY_PER_ITEM } from "../config/constants.js";

const toClient = (cart) =>
  (cart?.items || []).map((i) => ({
    productId: i.product.toString(),
    variantId: i.variantId.toString(),
    qty: i.qty,
  }));

// ---------------------------- Get my saved cart ----------------------------
export const getMyCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  res.status(200).json({ items: toClient(cart) });
};

// ---------------------------- Replace my saved cart ----------------------------
// The website sends the whole cart after every change (add, remove, quantity).
export const saveMyCart = async (req, res) => {
  const merged = new Map();
  for (const item of req.body.items) {
    const key = `${item.productId}:${item.variantId}`;
    const qty = Math.min((merged.get(key)?.qty || 0) + item.qty, MAX_QTY_PER_ITEM);
    merged.set(key, { product: item.productId, variantId: item.variantId, qty });
  }

  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $set: { items: [...merged.values()] } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  res.status(200).json({ items: toClient(cart) });
};
