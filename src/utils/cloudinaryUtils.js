import { cloudinary } from "../config/cloudinaryConfig.js";
import { resilientAgent } from "../config/dnsFallback.js";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Settings from "../models/settingsModel.js";

// Images used outside the Product collection (category tiles, home hero), so
// the sweep and the single-image delete never remove one that's still in use.
const otherImageUrls = async () => {
  const [categories, settings] = await Promise.all([
    Category.find({ image: { $ne: "" } }, { image: 1 }).lean(),
    Settings.findOne({ key: "shop" }, { "hero.images": 1 }).lean(),
  ]);
  return [...categories.map((c) => c.image), ...(settings?.hero?.images || [])].filter(Boolean);
};

// Every product image lives in this Cloudinary folder
export const CLOUDINARY_FOLDER = "egypt-supplements";

// Uploads younger than this are never swept, because an admin may still be
// filling in the form they were uploaded for
const ORPHAN_MIN_AGE_HOURS = 24;

// ---------------------------- Extract Public ID ----------------------------
// https://res.cloudinary.com/<cloud>/image/upload/v123/egypt-supplements/abc.jpg
//   -> "egypt-supplements/abc"
export const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const parts = url.split("?")[0].split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null; // Not a standard Cloudinary URL

    const afterUpload = parts.slice(uploadIndex + 1);
    if (/^v\d+$/.test(afterUpload[0] || "")) afterUpload.shift();

    const publicIdWithExt = afterUpload.join("/");
    const lastDot = publicIdWithExt.lastIndexOf(".");
    return lastDot !== -1
      ? publicIdWithExt.substring(0, lastDot)
      : publicIdWithExt;
  } catch (error) {
    console.error("Failed to extract Cloudinary public ID", error);
    return null;
  }
};

// Only ever touch images inside our own folder
const isOurPublicId = (publicId) =>
  Boolean(publicId) && publicId.startsWith(`${CLOUDINARY_FOLDER}/`);

// ---------------------------- Delete one image ----------------------------
// Deletes the image unless a product still uses it. Never throws: a failed
// delete is logged and left for the daily sweep to retry.
// Returns true when the image is gone (or was never there).
export const destroyImageIfUnused = async (imageUrl, { excludeProductId } = {}) => {
  const publicId = extractPublicId(imageUrl);
  if (!isOurPublicId(publicId)) return false;

  try {
    const filter = { image: imageUrl };
    if (excludeProductId) filter._id = { $ne: excludeProductId };
    if (await Product.exists(filter)) return false;

    // Also keep it if a category tile or the home hero still points at it
    const others = await otherImageUrls();
    if (others.includes(imageUrl)) return false;

    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true, agent: resilientAgent });
    // "not found" means it is already gone, which is fine
    if (result?.result !== "ok" && result?.result !== "not found") {
      console.error(`Cloudinary did not delete ${publicId}:`, result);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Cloudinary deletion error for ${publicId}:`, error);
    return false;
  }
};

// ---------------------------- Sweep orphaned images ----------------------------
// Safety net for anything the normal paths missed: a browser tab closed mid-edit,
// a failed destroy, images from before this cleanup existed. Deletes every image
// in our folder that no product uses and that is older than ORPHAN_MIN_AGE_HOURS.
export const cleanupOrphanImages = async ({ dryRun = false, force = false } = {}) => {
  const products = await Product.find({}, { image: 1 }).lean();

  // Guard: an empty product list almost always means the wrong or a fresh
  // database (for example mid-migration), not that every image is unused
  if (products.length === 0 && !force) {
    return { skipped: "No products found, so nothing was deleted", dryRun };
  }
  const others = await otherImageUrls();
  const usedIds = new Set(
    [...products.map((p) => p.image), ...others].map(extractPublicId).filter(Boolean),
  );

  const cutoff = Date.now() - ORPHAN_MIN_AGE_HOURS * 60 * 60 * 1000;
  const orphans = [];
  let scanned = 0;
  let nextCursor;

  do {
    const page = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: `${CLOUDINARY_FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });
    for (const resource of page.resources || []) {
      scanned += 1;
      const createdAt = new Date(resource.created_at).getTime();
      if (!usedIds.has(resource.public_id) && createdAt < cutoff) {
        orphans.push(resource.public_id);
      }
    }
    nextCursor = page.next_cursor;
  } while (nextCursor);

  // Guard: refuse to wipe most of the library in one go unless forced
  if (!force && orphans.length > 20 && orphans.length > scanned / 2) {
    return {
      scanned,
      inUse: usedIds.size,
      orphans: orphans.length,
      deleted: 0,
      skipped: "More than half the images look unused, so nothing was deleted. Run again with force if that is expected.",
      dryRun,
    };
  }

  let deleted = 0;
  if (!dryRun) {
    // The Admin API deletes up to 100 public IDs per call
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100);
      try {
        const result = await cloudinary.api.delete_resources(batch, { invalidate: true });
        deleted += Object.values(result?.deleted || {}).filter(
          (status) => status === "deleted",
        ).length;
      } catch (error) {
        console.error("Cloudinary bulk delete error:", error);
      }
    }
  }

  return { scanned, inUse: usedIds.size, orphans: orphans.length, deleted, dryRun };
};

// ---------------------------- Daily schedule ----------------------------
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const runCleanup = async () => {
  try {
    const summary = await cleanupOrphanImages();
    if (summary.skipped) {
      console.warn(`🧹 Image cleanup skipped: ${summary.skipped}`);
    } else if (summary.orphans > 0) {
      console.log(
        `🧹 Image cleanup: removed ${summary.deleted} of ${summary.orphans} unused images`,
      );
    }
  } catch (error) {
    console.error("Image cleanup failed:", error.message || error);
  }
};

export const scheduleImageCleanup = () => {
  if (!process.env.CLOUDINARY_API_SECRET) return;
  // First run a few minutes after start, so it doesn't race the DB connection
  setTimeout(runCleanup, 5 * 60 * 1000).unref();
  setInterval(runCleanup, ONE_DAY_MS).unref();
};
