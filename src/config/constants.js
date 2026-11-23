// Fixed shop constants (not editable from the dashboard). Everything an admin
// can change (delivery fees, contact details, social links, home images) lives
// in the Settings document instead - see models/settingsModel.js.
export const CURRENCY = "EGP";

// The most of one item a customer can order at once.
export const MAX_QTY_PER_ITEM = 10;

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
