import express from "express";
import { cloudinary, upload } from "../config/cloudinaryConfig.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import {
  CLOUDINARY_FOLDER,
  cleanupOrphanImages,
  destroyImageIfUnused,
} from "../utils/cloudinaryUtils.js";
import { isNetworkHiccup, resilientAgent } from "../config/dnsFallback.js";

const router = express.Router();

// Wraps Cloudinary's callback-based stream in a Promise so failures reach the
// global error handler instead of being thrown inside a callback (which used
// to crash the whole Node process).
const uploadBufferToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER, // Cloudinary will create this folder
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 800, height: 800, crop: "limit" }],
        agent: resilientAgent, // public DNS fallback when this PC's DNS fails
        // Slow home connections need longer than the 60s default. On Vercel a
        // request may only run 60s in total, so wait less there.
        timeout: process.env.VERCEL ? 25000 : 90000,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });

router.post("/", protect, admin, upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  let result;
  try {
    try {
      result = await uploadBufferToCloudinary(req.file.buffer);
    } catch (error) {
      // A DNS or connection blip: wait a moment and try once more
      if (!isNetworkHiccup(error)) throw error;
      console.warn("Cloudinary upload hiccup, retrying once:", error?.message || error?.error?.message);
      await new Promise((r) => setTimeout(r, 1500));
      result = await uploadBufferToCloudinary(req.file.buffer);
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(502);
    throw new Error(
      isNetworkHiccup(error)
        ? "The picture couldn't be uploaded because the internet connection to the image service failed. Please check your internet and try again."
        : "The picture couldn't be uploaded. Please try again.",
    );
  }

  res.status(200).json({
    message: "Image uploaded successfully",
    imageUrl: result.secure_url,
  });
});

// Discard an image the admin uploaded but never saved to a product
// (removed it, picked another one, or closed the form). Images that a
// product still uses are never deleted here.
router.delete("/", protect, admin, async (req, res) => {
  const imageUrl = req.body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    res.status(400);
    throw new Error("imageUrl is required");
  }
  const deleted = await destroyImageIfUnused(imageUrl);
  res.status(200).json({ deleted });
});

// Sweep Cloudinary for images no product uses (older than 24 hours).
// Also runs automatically once a day. Send { "dryRun": true } to preview.
router.post("/cleanup", protect, admin, async (req, res) => {
  const summary = await cleanupOrphanImages({
    dryRun: req.body?.dryRun === true,
    force: req.body?.force === true,
  });
  res.status(200).json(summary);
});

export default router;
