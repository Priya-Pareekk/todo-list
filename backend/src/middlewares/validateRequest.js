const { validationResult } = require("express-validator");
const { sendError } = require("../utils/apiResponse");

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return sendError(res, {
      statusCode: 400,
      message: "Request validation failed",
      details: errors.array()
    });
  }

  next();
};

module.exports = validateRequest;
