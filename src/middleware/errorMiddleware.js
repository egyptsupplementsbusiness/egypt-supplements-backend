import { ZodError } from "zod";
import multer from "multer";
import { IS_PRODUCTION } from "../config/env.js";
import { logEvent } from "../utils/logger.js";

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = async (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  // Handle Zod Validation Errors
  if (err instanceof ZodError || err.name === "ZodError") {
    statusCode = 400;

    const zodIssues = err.issues || err.errors;

    if (zodIssues && Array.isArray(zodIssues)) {
      message = zodIssues.map((issue) => issue.message).join(", ");
    } else {
      message = "Validation failed: Check your input data";
    }
  }

  // Handle Mongoose Bad ObjectId
  else if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found in the database";
  }

  // Handle Mongoose schema validation errors (e.g. invalid email format)
  else if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Handle duplicate keys (e.g. two accounts registering the same email at once)
  else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `That ${field} is already in use`;
  }

  // Handle upload errors (file too large, wrong field name, etc.)
  else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large. The maximum size is 4 MB."
        : err.message;
  }

  // Malformed JSON body
  else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON in request body";
  }

  // An unexpected crash (a bug or a database problem): on the live site, keep
  // the technical details in the server log and show the visitor a plain message.
  if (statusCode === 500) {
    console.error(`💥 ${req.method} ${req.originalUrl}:`, err);
    // Shows up in the admin Activity log under "Errors"
    await logEvent("error", `${req.method} ${req.originalUrl.split("?")[0]}: ${err.message}`, {
      user: req.user,
      details: { stack: String(err.stack || "").slice(0, 1500) },
    });
    if (IS_PRODUCTION) message = "Something went wrong on our side. Please try again in a moment.";
  }

  res.status(statusCode).json({
    message: message,
    // Only expose stack traces when running on this computer in development
    stack: !IS_PRODUCTION && process.env.NODE_ENV === "development" ? err.stack : null,
  });
};
