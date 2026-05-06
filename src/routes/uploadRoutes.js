import express from "express";
import { cloudinary, upload } from "../config/cloudinaryConfig.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, admin, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  // 1. Create a Cloudinary upload stream
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: "egypt-supplements", // Cloudinary will create this folder
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 800, height: 800, crop: "limit" }],
    },
    (error, result) => {
      // 2. Handle the response from Cloudinary
      if (error) {
        console.error(error);
        res.status(500);
        throw new Error("Image upload failed");
      }

      // 3. Send the secure URL back to the frontend/Postman
      res.status(200).json({
        message: "Image uploaded successfully",
        imageUrl: result.secure_url,
      });
    },
  );

  // 4. Pipe the image from the server's RAM to Cloudinary
  stream.end(req.file.buffer);
});

export default router;
