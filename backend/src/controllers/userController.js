const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const buildJwtToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign({ sub: userId }, secret, { expiresIn: "1d" });
};

const isOAuthOnlyAccount = (user) => {
  return user.authProvider !== "local" && !user.password;
};

// Creates a new local user account with hashed password.
const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  console.log("[auth] signup attempt", { email: normalizedEmail });

  if (!name || !normalizedEmail || !password) {
    return sendError(res, {
      statusCode: 400,
      message: "name, email and password are required"
    });
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    // Legacy bootstrap users were created without password. Allow upgrading them.
    if (existingUser.authProvider === "local" && !existingUser.password) {
      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.name = (name || existingUser.name || normalizedEmail.split("@")[0]).trim();
      await existingUser.save();

      console.log("[auth] signup upgraded legacy local account", {
        userId: String(existingUser._id),
        email: existingUser.email
      });

      return sendSuccess(res, {
        statusCode: 200,
        message: "Account upgraded. You can now login with password.",
        data: {
          userId: existingUser._id,
          name: existingUser.name,
          email: existingUser.email
        }
      });
    }

    if (isOAuthOnlyAccount(existingUser)) {
      return sendError(res, {
        statusCode: 409,
        message: "Email already exists with Google sign-in. Use Google OAuth login."
      });
    }

    return sendError(res, {
      statusCode: 409,
      message: "Email already exists"
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: passwordHash,
    authProvider: "local"
  });

  console.log("[auth] signup success", { userId: String(user._id), email: user.email });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Signup successful",
    data: {
      userId: user._id,
      name: user.name,
      email: user.email
    }
  });
});

// Logs in an existing user after password verification and returns JWT.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  console.log("[auth] login attempt", { email: normalizedEmail });

  if (!normalizedEmail || !password) {
    return sendError(res, {
      statusCode: 400,
      message: "email and password are required"
    });
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user) {
    console.log("[auth] login failed - user not found", { email: normalizedEmail });
    return sendError(res, {
      statusCode: 401,
      message: "User not found"
    });
  }

  if (isOAuthOnlyAccount(user)) {
    return sendError(res, {
      statusCode: 401,
      message: "This account uses Google OAuth. Please login with Google."
    });
  }

  if (!user.password && user.authProvider === "local") {
    console.log("[auth] login blocked - local account missing password", {
      userId: String(user._id),
      email: user.email
    });
    return sendError(res, {
      statusCode: 401,
      message: "Local account has no password set (legacy account). Use Sign up with the same email once to set password."
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    console.log("[auth] login failed - invalid password", { userId: String(user._id) });
    return sendError(res, {
      statusCode: 401,
      message: "Invalid password"
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = buildJwtToken(String(user._id));

  console.log("[auth] login success", { userId: String(user._id), email: user.email });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      token,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

// Returns the currently authenticated user.
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, {
      statusCode: 404,
      message: "User not found"
    });
  }

  return sendSuccess(res, {
    statusCode: 200,
    message: "Authenticated user fetched",
    data: {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      authProvider: user.authProvider
    }
  });
});

module.exports = {
  signup,
  login,
  me
};
