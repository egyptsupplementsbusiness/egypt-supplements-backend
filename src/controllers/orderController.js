import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import Cart from "../models/cartModel.js";
import { getSettings, shippingFor, publicSettings } from "../models/settingsModel.js";
import { MAX_PENDING_ORDERS_PER_ACCOUNT, PENDING_ORDER_EXPIRY_DAYS } from "../config/constants.js";

// ---------------------------- Helpers ----------------------------
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The price a customer pays for one option: the sale price when it has one.
const effectivePrice = (variant) => {
  const sale = Number(variant.discountedPrice);
  return sale > 0 && sale < Number(variant.price) ? sale : Number(variant.price);
};

const variantLabel = (variant) =>
  [variant.flavor, variant.size, variant.servings ? `${variant.servings} servings` : ""]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");

// "ES" + date + 4 random digits, e.g. ES2611230427
const newOrderNumber = () => {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ES${date}${Math.floor(1000 + Math.random() * 9000)}`;
};

// Take stock for one line. Only succeeds if there is enough left, so two
// customers can never both buy the last tub.
const takeStock = (item) =>
  Product.updateOne(
    {
      _id: item.product,
      variants: { $elemMatch: { _id: item.variantId, countInStock: { $gte: item.qty } } },
    },
    { $inc: { "variants.$.countInStock": -item.qty } },
  );

// Put stock back (order cancelled, or a later line in the same order failed).
// Skipped silently if the product or option was deleted since.
const returnStock = (items) =>
  Promise.all(
    items.map((item) =>
      Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.countInStock": item.qty } },
      ),
    ),
  );

const pushStatus = (order, status, by) => {
  order.status = status;
  order.statusHistory.push({ status, by, at: new Date() });
};

// ---------------------------- Shop settings (public) ----------------------------
// Kept for older clients; the same data now also lives at GET /api/settings.
export const getShopSettings = async (req, res) => {
  const settings = await getSettings();
  res.status(200).json(publicSettings(settings));
};

// ---------------------------- Place an order (customer) ----------------------------
export const createOrder = async (req, res) => {
  const { items: requested, shippingAddress } = req.body;

  // One account can only have a few orders waiting for confirmation at once,
  // so nobody can hold all the stock with orders they never mean to take.
  const waiting = await Order.countDocuments({ user: req.user._id, status: "pending" });
  if (waiting >= MAX_PENDING_ORDERS_PER_ACCOUNT) {
    res.status(429);
    throw new Error(
      `You already have ${waiting} orders waiting for the shop to confirm them. ` +
        "Please wait until we confirm one (we'll contact you), or cancel one from My orders, then try again.",
    );
  }

  // Merge duplicate lines (same product option added twice)
  const merged = new Map();
  for (const line of requested) {
    const key = `${line.productId}:${line.variantId}`;
    const prev = merged.get(key);
    merged.set(key, { ...line, qty: (prev?.qty || 0) + line.qty });
  }
  const lines = [...merged.values()];

  // Load every product once, and build the order lines from the database,
  // never from prices the browser sent
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const items = [];
  const problems = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    const variant = product?.variants.id(line.variantId);
    if (!product || !variant) {
      problems.push("One of the items in your cart is no longer available. Please remove it and try again.");
      continue;
    }
    if (variant.countInStock < line.qty) {
      const label = variantLabel(variant);
      problems.push(
        variant.countInStock === 0
          ? `${product.name}${label ? ` (${label})` : ""} is sold out.`
          : `Only ${variant.countInStock} left of ${product.name}${label ? ` (${label})` : ""}.`,
      );
      continue;
    }
    items.push({
      product: product._id,
      variantId: variant._id,
      name: product.name,
      brand: product.brand,
      variantLabel: variantLabel(variant),
      image: product.image,
      price: effectivePrice(variant),
      qty: line.qty,
    });
  }

  if (problems.length > 0) {
    res.status(409);
    throw new Error(problems.join(" "));
  }

  // Reserve the stock, line by line. If any line fails (someone else just
  // bought it), give back what was already taken and stop.
  const taken = [];
  for (const item of items) {
    const result = await takeStock(item);
    if (result.modifiedCount !== 1) {
      await returnStock(taken);
      res.status(409);
      throw new Error(`Sorry, ${item.name} just sold out. Please update your cart and try again.`);
    }
    taken.push(item);
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const settings = await getSettings();
  const shippingFee = shippingFor(subtotal, settings);

  try {
    let order;
    // Retry on the (very rare) chance of a duplicate order number
    for (let attempt = 0; attempt < 5 && !order; attempt += 1) {
      try {
        order = await Order.create({
          orderNumber: newOrderNumber(),
          user: req.user._id,
          items,
          shippingAddress,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          statusHistory: [{ status: "pending", by: "customer" }],
        });
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
    // The order is in: empty the saved cart (failure here doesn't matter)
    await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } }).catch(() => {});
    res.status(201).json({ message: "Order placed", order });
  } catch (error) {
    await returnStock(taken);
    throw error;
  }
};

// ---------------------------- My orders (customer) ----------------------------
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.status(200).json({ orders });
};

export const getMyOrderById = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  res.status(200).json(order);
};

// Customers can cancel only while the order is still "pending" (not yet
// confirmed by the shop). After that they have to contact the shop.
export const cancelMyOrder = async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: "pending" },
    {
      $set: { status: "cancelled", cancelledBy: "customer" },
      $push: { statusHistory: { status: "cancelled", by: "customer", at: new Date() } },
    },
    { returnDocument: "after" },
  );

  if (!order) {
    const existing = await Order.findOne({ _id: req.params.id, user: req.user._id }).select("status").lean();
    res.status(existing ? 400 : 404);
    throw new Error(
      !existing
        ? "Order not found"
        : existing.status === "cancelled"
          ? "This order is already cancelled."
          : existing.status === "delivered"
            ? "This order has already been delivered, so it can't be cancelled. Please contact us on WhatsApp."
            : "This order has already been confirmed, so it can't be cancelled here. Please contact us on WhatsApp.",
    );
  }

  await returnStock(order.items);
  res.status(200).json({ message: "Order cancelled", order });
};

// ---------------------------- Auto-cancel old unconfirmed orders ----------------------------
// An order still "pending" after PENDING_ORDER_EXPIRY_DAYS is cancelled by the
// system and its items go back into stock. Runs once a day (Vercel Cron, see
// app.js) and, at most once an hour, when the admin opens the orders list.
export const expireStalePendingOrders = async () => {
  const cutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const stale = await Order.find({ status: "pending", createdAt: { $lt: cutoff } }).select("_id").lean();

  let cancelled = 0;
  for (const { _id } of stale) {
    // Only if it's still pending right now (the admin may be confirming it)
    const order = await Order.findOneAndUpdate(
      { _id, status: "pending" },
      {
        $set: { status: "cancelled", cancelledBy: "system" },
        $push: { statusHistory: { status: "cancelled", by: "system", at: new Date() } },
      },
      { returnDocument: "after" },
    );
    if (!order) continue;
    await returnStock(order.items);
    cancelled += 1;
  }
  if (cancelled > 0) console.log(`⏰ Auto-cancelled ${cancelled} order(s) not confirmed within ${PENDING_ORDER_EXPIRY_DAYS} days`);
  return { checked: stale.length, cancelled };
};

let lastExpiryRun = 0;
const expireStaleOrdersNowAndThen = async () => {
  if (Date.now() - lastExpiryRun < 60 * 60 * 1000) return;
  lastExpiryRun = Date.now();
  try {
    await expireStalePendingOrders();
  } catch (error) {
    lastExpiryRun = 0;
    console.error("Auto-cancel of old orders failed:", error.message);
  }
};

// ---------------------------- All orders (admin) ----------------------------
const ACTIVE_STATUSES = ["pending", "processing", "shipped"];

export const getAllOrders = async (req, res) => {
  await expireStaleOrdersNowAndThen();
  const pageSize = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);

  const query = {};
  const status = req.query.status;
  if (status === "active") query.status = { $in: ACTIVE_STATUSES };
  else if (typeof status === "string" && status && status !== "all") query.status = status;

  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  if (keyword) {
    const regex = { $regex: escapeRegex(keyword.replace(/^#/, "")), $options: "i" };
    query.$or = [
      { orderNumber: regex },
      { "shippingAddress.fullName": regex },
      { "shippingAddress.phone": regex },
    ];
  }

  const [count, orders, statusCounts] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .populate("user", "name email phone"),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  res.status(200).json({
    orders,
    page,
    pages: Math.ceil(count / pageSize),
    totalOrders: count,
    counts,
  });
};

export const getOrderByIdAdmin = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  res.status(200).json(order);
};

// The admin normally moves an order one step forward, but may also set any
// step by hand to fix a mistake. Stock follows the order: cancelling puts it
// back, and un-cancelling takes it again (if there is still enough).
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const current = order.status;
  if (current === status) {
    return res.status(200).json({ message: "No change", order: await order.populate("user", "name email phone") });
  }

  // Bringing a cancelled order back: the items must still be in stock
  const taken = [];
  if (current === "cancelled") {
    for (const item of order.items) {
      const result = await takeStock(item);
      if (result.modifiedCount !== 1) {
        await returnStock(taken);
        res.status(409);
        throw new Error(`Not enough stock left of ${item.name} to bring this order back.`);
      }
      taken.push(item);
    }
  }

  // Save only if nobody else changed the status in the meantime
  const update = {
    $set: { status, cancelledBy: status === "cancelled" ? "admin" : null },
    $push: { statusHistory: { status, by: "admin", at: new Date() } },
  };
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: current }, update, {
    returnDocument: "after",
  }).populate("user", "name email phone");

  if (!updated) {
    await returnStock(taken);
    res.status(409);
    throw new Error("This order has changed since you opened it. Please refresh and try again.");
  }

  if (status === "cancelled") await returnStock(updated.items);

  res.status(200).json({ message: "Order updated", order: updated });
};

// ---------------------------- Numbers for the admin home ----------------------------
export const getOrderSummary = async (req, res) => {
  await expireStaleOrdersNowAndThen();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [byStatus, thisMonth] = await Promise.all([
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: monthStart }, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          sales: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        },
      },
    ]),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  res.status(200).json({
    counts,
    ordersThisMonth: thisMonth[0]?.orders || 0,
    deliveredSalesThisMonth: thisMonth[0]?.sales || 0,
  });
};

// ---------------------------- Sales report (admin) ----------------------------
// A real report built from orders, with a monthly or yearly view. "Sales"
// counts delivered orders only (money actually collected). "Orders" counts
// every placed order except cancelled ones.
export const getSalesReport = async (req, res) => {
  const range = req.query.range === "year" ? "year" : "month";
  const now = new Date();

  // Window: last 12 months, or last 5 years
  const start =
    range === "year"
      ? new Date(now.getFullYear() - 4, 0, 1)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const groupId =
    range === "year"
      ? { y: { $year: "$createdAt" } }
      : { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } };

  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: start }, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: groupId,
        orders: { $sum: 1 },
        // Value of every placed (not cancelled) order, for the average order
        placedValue: { $sum: "$total" },
        sales: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
      },
    },
  ]);

  // Index the results so we can fill in empty periods with zeros
  const byKey = new Map(
    rows.map((r) => [range === "year" ? `${r._id.y}` : `${r._id.y}-${r._id.m}`, r]),
  );

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const points = [];
  if (range === "year") {
    for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y += 1) {
      const r = byKey.get(`${y}`);
      points.push({ label: `${y}`, orders: r?.orders || 0, placedValue: r?.placedValue || 0, sales: r?.sales || 0, deliveredOrders: r?.deliveredOrders || 0 });
    }
  } else {
    const cursor = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 12; i += 1) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const r = byKey.get(`${y}-${m}`);
      points.push({
        label: `${MONTHS[cursor.getMonth()]} ${String(y).slice(2)}`,
        orders: r?.orders || 0,
        placedValue: r?.placedValue || 0,
        sales: r?.sales || 0,
        deliveredOrders: r?.deliveredOrders || 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const totals = points.reduce(
    (acc, p) => ({
      orders: acc.orders + p.orders,
      placedValue: acc.placedValue + p.placedValue,
      sales: acc.sales + p.sales,
      deliveredOrders: acc.deliveredOrders + p.deliveredOrders,
    }),
    { orders: 0, placedValue: 0, sales: 0, deliveredOrders: 0 },
  );
  // Average over every order placed (not cancelled), matching "Orders placed"
  totals.avgOrderValue = totals.orders ? Math.round(totals.placedValue / totals.orders) : 0;

  res.status(200).json({ range, points, totals });
};
