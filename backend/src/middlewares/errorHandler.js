const { sendError } = require("../utils/apiResponse");

const notFound = (req, res) => {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (err.name === "ValidationError") {
    return sendError(res, {
      statusCode: 400,
      message: "Validation failed",
      details: err.errors
    });
  }

  if (err.code === 11000) {
    return sendError(res, {
      statusCode: 409,
      message: "Duplicate value",
      details: err.keyValue
    });
  }

  return sendError(res, {
    statusCode,
    message: err.message || "Internal server error"
  });
};

module.exports = {
  notFound,
  errorHandler
};
