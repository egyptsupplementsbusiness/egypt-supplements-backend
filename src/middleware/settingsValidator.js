import { z } from "zod";
import { SOCIAL_PLATFORMS } from "../config/constants.js";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), "Links must start with http:// or https://");

export const updateSettingsSchema = z.object({
  shipping: z
    .object({
      mode: z.enum(["threshold", "free", "paid"]).optional(),
      fee: z.number().min(0, "Fee can't be negative").max(100000).optional(),
      freeThreshold: z.number().min(0).max(1000000).optional(),
    })
    .optional(),
  contact: z
    .object({
      phone: z.string().trim().max(40).optional(),
      // digits only; the site builds the wa.me link from this
      whatsapp: z
        .string()
        .trim()
        .max(20)
        .refine((v) => v === "" || /^\d{8,15}$/.test(v.replace(/[\s+]/g, "")), "WhatsApp number should be digits only, with country code, e.g. 201012345678")
        .optional(),
      email: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email").optional(),
      address: z.string().trim().max(200).optional(),
      city: z.string().trim().max(60).optional(),
      hours: z.string().trim().max(80).optional(),
      cityAr: z.string().trim().max(60).optional(),
      addressAr: z.string().trim().max(200).optional(),
      hoursAr: z.string().trim().max(80).optional(),
    })
    .optional(),
  // Website texts: { "home.hero.title1": { en, ar } }. Keys are the site's own
  // text names; empty values mean "use the built-in text".
  texts: z
    .record(
      z.string().regex(/^[a-z][a-zA-Z0-9.]{1,60}$/, "Unknown text name"),
      z.object({
        en: z.string().trim().max(600, "That text is too long (600 letters at most)").optional().default(""),
        ar: z.string().trim().max(600, "That text is too long (600 letters at most)").optional().default(""),
      }),
    )
    .refine((v) => Object.keys(v).length <= 150, "Too many texts")
    .optional(),
  socials: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        url: optionalUrl,
        visible: z.boolean(),
      }),
    )
    .max(SOCIAL_PLATFORMS.length)
    .optional(),
  hero: z
    .object({
      images: z.array(z.string().trim().max(400)).max(2, "The hero can show at most 2 images").optional(),
      empty: z.boolean().optional(),
      animate: z.boolean().optional(),
      showBadges: z.boolean().optional(),
    })
    .optional(),
});
