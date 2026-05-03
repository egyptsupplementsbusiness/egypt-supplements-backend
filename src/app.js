import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import userRoutes from "./routes/userRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ---------------------------- Base Routes ----------------------------
app.get("/api/status", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "E-commerce API is live and routing correctly.",
  });
});

// ---------------------------- User Routes ----------------------------
app.use("/api/users", userRoutes);

// ---------------------------- Global Error Handler ----------------------------
app.use(notFound);
app.use(errorHandler);

export default app;
