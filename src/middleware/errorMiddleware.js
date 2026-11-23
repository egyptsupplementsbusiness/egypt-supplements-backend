import { ZodError } from "zod";
import multer from "multer";

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
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

  res.status(statusCode).json({
    message: message,
    // Only expose stack traces when explicitly running in development
    stack: process.env.NODE_ENV === "development" ? err.stack : null,
  });
};
