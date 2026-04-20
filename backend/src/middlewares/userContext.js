const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError } = require("../utils/apiResponse");
const { syncUserSubscription } = require("../utils/subscriptionService");

// Verifies JWT and injects authenticated user into req.user.
const requireUserContext = async (req, res, next) => {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return sendError(res, {
      statusCode: 401,
      message: "Unauthorized. Bearer token is required."
    });
  }

  if (!process.env.JWT_SECRET) {
    return sendError(res, {
      statusCode: 500,
      message: "JWT_SECRET is not configured on server."
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
      message: "Invalid or expired token"
    });
  }

  const userId = payload.sub;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return sendError(res, {
      statusCode: 401,
      message: "Invalid token payload"
    });
  }

  if (payload.type && payload.type !== "access") {
    return sendError(res, {
      statusCode: 403,
      message: "Forbidden: access token required"
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, {
      statusCode: 401,
      message: "User not found for provided token."
    });
  }

  const subscription = await syncUserSubscription(user);

  req.user = user;
  req.subscription = subscription;
  next();
};

module.exports = requireUserContext;
