// Fixed shop constants (not editable from the dashboard). Everything an admin
// can change (delivery fees, contact details, social links, home images) lives
// in the Settings document instead - see models/settingsModel.js.
export const CURRENCY = "EGP";

// The most of one item a customer can order at once.
export const MAX_QTY_PER_ITEM = 10;

// The most orders one account can have waiting for the shop to confirm them
// ("Placed" / pending) at the same time. Stops one person reserving all the stock.
export const MAX_PENDING_ORDERS_PER_ACCOUNT = 3;

// An order still waiting for confirmation after this many days is cancelled
// automatically, and its items go back into stock.
export const PENDING_ORDER_EXPIRY_DAYS = 7;

// When a variant's stock is at or below this, the site may show "Only X left"
// to a shopper. Above it, exact numbers stay hidden from the public.
export const LOW_STOCK_THRESHOLD = 5;

// The social platforms the footer knows how to show, in display order.
export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "whatsapp",
  "youtube",
  "x",
];
