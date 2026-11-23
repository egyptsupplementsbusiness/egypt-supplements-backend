import express from "express";
import { z } from "zod";
import { getMyCart, saveMyCart } from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const saveCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        variantId: objectId,
        qty: z.number().int().min(1).max(99),
      }),
    )
    .max(50, "Too many items in the cart"),
});

const router = express.Router();

router.get("/", protect, getMyCart);
router.put("/", protect, validate(saveCartSchema), saveMyCart);

export default router;
