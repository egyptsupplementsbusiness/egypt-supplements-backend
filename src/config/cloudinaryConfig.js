import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// 1. Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Use Multer's Memory Storage (holds the file in RAM temporarily)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Export both so we can use them in the route
export { cloudinary, upload };
