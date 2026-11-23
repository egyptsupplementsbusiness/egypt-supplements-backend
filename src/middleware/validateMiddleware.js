// Validates req.body against a zod schema and replaces it with the parsed
// result, so fields that are not in the schema never reach the controllers.
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error); // This sends it to the errorHandler
  }
};
