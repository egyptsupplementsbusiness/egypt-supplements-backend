import { getSettings, publicSettings } from "../models/settingsModel.js";
import { destroyImageIfUnused } from "../utils/cloudinaryUtils.js";
import { logEvent } from "../utils/logger.js";

// ---------------------------- Public ----------------------------
// What the website reads: delivery rule, contact details, visible socials, hero.
export const getPublicSettings = async (req, res) => {
  const settings = await getSettings();
  res.status(200).json(publicSettings(settings));
};

// ---------------------------- Admin ----------------------------
export const getAdminSettings = async (req, res) => {
  const settings = await getSettings();
  res.status(200).json(settings);
};

export const updateSettings = async (req, res) => {
  const settings = await getSettings();
  const { shipping, contact, socials, hero, texts } = req.body;

  if (shipping) {
    if (shipping.mode !== undefined) settings.shipping.mode = shipping.mode;
    if (shipping.fee !== undefined) settings.shipping.fee = shipping.fee;
    if (shipping.freeThreshold !== undefined) settings.shipping.freeThreshold = shipping.freeThreshold;
  }

  if (contact) {
    for (const field of ["phone", "whatsapp", "email", "address", "city", "hours", "cityAr", "addressAr", "hoursAr"]) {
      if (contact[field] !== undefined) settings.contact[field] = contact[field];
    }
  }

  if (socials) settings.socials = socials;

  if (texts) {
    // Only keep texts the admin actually wrote something for
    const kept = {};
    for (const [key, value] of Object.entries(texts)) {
      if (value.en || value.ar) kept[key] = { en: value.en || "", ar: value.ar || "" };
    }
    settings.texts = kept;
    settings.markModified("texts");
  }

  // Hero images: remember what's being removed so those Cloudinary files go too
  let removedImages = [];
  if (hero) {
    if (Array.isArray(hero.images)) {
      const before = settings.hero?.images || [];
      removedImages = before.filter((url) => !hero.images.includes(url));
      settings.hero.images = hero.images;
    }
    if (hero.empty !== undefined) settings.hero.empty = hero.empty;
    if (hero.animate !== undefined) settings.hero.animate = hero.animate;
    if (hero.showBadges !== undefined) settings.hero.showBadges = hero.showBadges;
  }

  const saved = await settings.save();

  // Clean up any hero image the admin took off (best effort, never blocks)
  for (const url of removedImages) {
    await destroyImageIfUnused(url);
  }

  const sections = [
    shipping && "delivery",
    contact && "contact details",
    socials && "social links",
    hero && "home page banner",
    texts && "website texts",
  ].filter(Boolean);
  await logEvent("admin", `Changed shop settings${sections.length ? `: ${sections.join(", ")}` : ""}`, { user: req.user });
  res.status(200).json(saved);
};
