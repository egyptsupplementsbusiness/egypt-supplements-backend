import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import "dotenv/config";
import "./dnsFallback.js"; // public DNS fallback for api.cloudinary.com

// 1. Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Use Multer's Memory Storage (holds the file in RAM temporarily)
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage,
  // 4 MB. Vercel refuses any request over 4.5 MB, so stay under that.
  // The admin page shrinks photos before sending, so this is rarely reached.
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error("Only JPG, PNG or WEBP images are allowed");
      error.statusCode = 400;
      cb(error);
    }
  },
});

// Export both so we can use them in the route
export { cloudinary, upload };
