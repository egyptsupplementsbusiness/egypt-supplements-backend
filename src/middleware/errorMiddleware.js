import { ZodError } from "zod";

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle Zod Validation Errors
  if (err instanceof ZodError || err.name === "ZodError") {
    statusCode = 400;

    const zodIssues = err.issues || err.errors;

    if (zodIssues && Array.isArray(zodIssues)) {
      // Changed this line to just grab your custom message
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

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};
