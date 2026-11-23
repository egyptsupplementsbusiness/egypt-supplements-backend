import mongoose from "mongoose";
import { MAX_QTY_PER_ITEM, SOCIAL_PLATFORMS } from "../config/constants.js";

// One document holds every setting an admin can change from the dashboard.
// There is only ever one ("key" is fixed to "shop"), loaded with getSettings().

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    url: { type: String, default: "" },
    visible: { type: Boolean, default: false },
  },
  { _id: false },
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "shop", unique: true },

    // --- Delivery ---
    // mode "threshold" = free over an amount, otherwise a flat fee
    // mode "free"      = always free
    // mode "paid"      = always the flat fee
    shipping: {
      mode: { type: String, enum: ["threshold", "free", "paid"], default: "threshold" },
      fee: { type: Number, default: 50, min: 0 },
      freeThreshold: { type: Number, default: 2000, min: 0 },
    },

    // --- Contact details shown around the site ---
    contact: {
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" }, // digits only, e.g. 201012345678
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "Alexandria" },
      hours: { type: String, default: "Mon–Sat, 9 AM – 6 PM" },
    },

    // --- Footer social links ---
    socials: { type: [socialLinkSchema], default: [] },

    // --- Home page hero: 0, 1 or 2 images ---
    // images empty + empty:false  -> show the built-in stock image (default)
    // images has 1 or 2           -> show those
    // empty:true                  -> show no product image at all
    hero: {
      images: {
        type: [String],
        default: [],
        validate: [(v) => v.length <= 2, "The hero can show at most 2 images"],
      },
      empty: { type: Boolean, default: false },
      animate: { type: Boolean, default: true }, // gentle floating motion on the images
      showBadges: { type: Boolean, default: true }, // "Fast delivery" / "Pay on delivery" tags
    },
  },
  { timestamps: true },
);

const Settings = mongoose.model("Settings", settingsSchema);

// Default social rows (hidden until the admin adds a link), so the dashboard
// always shows the full set of platforms to fill in.
const defaultSocials = () =>
  SOCIAL_PLATFORMS.map((platform) => ({ platform, url: "", visible: false }));

/** The one settings document, created with defaults the first time. */
export const getSettings = async () => {
  let settings = await Settings.findOne({ key: "shop" });
  if (!settings) {
    settings = await Settings.create({ key: "shop", socials: defaultSocials() });
  } else if (!settings.socials || settings.socials.length === 0) {
    settings.socials = defaultSocials();
    await settings.save();
  }
  return settings;
};

/** Delivery fee for a given subtotal, following the chosen mode. */
export const shippingFor = (subtotal, settings) => {
  const s = settings?.shipping || {};
  if (s.mode === "free") return 0;
  if (s.mode === "paid") return s.fee ?? 0;
  return subtotal >= (s.freeThreshold ?? 0) ? 0 : s.fee ?? 0;
};

/** What the public website is allowed to see (no internal fields). */
export const publicSettings = (settings) => ({
  currency: "EGP",
  maxQtyPerItem: MAX_QTY_PER_ITEM,
  shipping: {
    mode: settings.shipping.mode,
    fee: settings.shipping.fee,
    freeThreshold: settings.shipping.freeThreshold,
  },
  contact: {
    phone: settings.contact.phone,
    whatsapp: settings.contact.whatsapp,
    email: settings.contact.email,
    address: settings.contact.address,
    city: settings.contact.city,
    hours: settings.contact.hours,
  },
  socials: (settings.socials || []).filter((s) => s.visible && s.url).map((s) => ({ platform: s.platform, url: s.url })),
  hero: {
    images: settings.hero?.images || [],
    empty: Boolean(settings.hero?.empty),
    animate: settings.hero?.animate !== false,
    showBadges: settings.hero?.showBadges !== false,
  },
});

export default Settings;
