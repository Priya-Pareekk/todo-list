const bcrypt = require("bcryptjs");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const {
  toTokenHash,
  parseExpiryToDate,
  buildAccessToken,
  buildRefreshToken,
  verifyRefreshToken,
  getRefreshExpiresIn
} = require("../utils/tokenService");

const isOAuthOnlyAccount = (user) => {
  return user.authProvider !== "local" && !user.password;
};

const getRequiredGoogleEnv = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL are required for Google OAuth.");
  }

  return { clientId, clientSecret, callbackUrl };
};

const issueAuthTokens = async (req, userId) => {
  const accessToken = buildAccessToken(String(userId));
  const refreshToken = buildRefreshToken(String(userId));

  await RefreshToken.create({
    userId,
    tokenHash: toTokenHash(refreshToken),
    expiresAt: parseExpiryToDate(getRefreshExpiresIn()),
    userAgent: req.header("user-agent") || "",
    ipAddress: req.ip || ""
  });

  return {
    accessToken,
    refreshToken
  };
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

  const tokens = await issueAuthTokens(req, user._id);

  console.log("[auth] login success", { userId: String(user._id), email: user.email });

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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

// Exchanges a valid refresh token for new access + refresh tokens.
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendError(res, {
      statusCode: 401,
      message: "refreshToken is required"
    });
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
      message: "Invalid or expired refresh token"
    });
  }

  if (payload.type !== "refresh") {
    return sendError(res, {
      statusCode: 401,
      message: "Invalid refresh token payload"
    });
  }

  const tokenHash = toTokenHash(refreshToken);
  const tokenRecord = await RefreshToken.findOne({
    tokenHash,
    userId: payload.sub,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!tokenRecord) {
    return sendError(res, {
      statusCode: 401,
      message: "Refresh token is revoked, expired, or unknown"
    });
  }

  tokenRecord.revokedAt = new Date();
  await tokenRecord.save();

  const tokens = await issueAuthTokens(req, payload.sub);
  const user = await User.findById(payload.sub);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Token refreshed",
    data: {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

// Revokes current refresh token to logout this session.
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const tokenHash = toTokenHash(refreshToken);
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  return sendSuccess(res, {
    statusCode: 200,
    message: "Logged out successfully",
    data: null
  });
});

// Starts Google OAuth by redirecting user to Google's consent screen.
const googleLogin = asyncHandler(async (req, res) => {
  const { clientId, callbackUrl } = getRequiredGoogleEnv();

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return res.redirect(googleAuthUrl.toString());
});

// Handles Google OAuth callback and issues app JWT tokens.
const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return sendError(res, {
      statusCode: 400,
      message: "Missing Google authorization code"
    });
  }

  const { clientId, clientSecret, callbackUrl } = getRequiredGoogleEnv();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return sendError(res, {
      statusCode: 401,
      message: "Google token exchange failed"
    });
  }

  const tokenData = await tokenResponse.json();
  const googleAccessToken = tokenData.access_token;

  if (!googleAccessToken) {
    return sendError(res, {
      statusCode: 401,
      message: "Google access token not received"
    });
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${googleAccessToken}`
    }
  });

  if (!profileResponse.ok) {
    return sendError(res, {
      statusCode: 401,
      message: "Failed to fetch Google user profile"
    });
  }

  const googleUser = await profileResponse.json();
  const email = String(googleUser.email || "").trim().toLowerCase();
  const name = String(googleUser.name || email.split("@")[0] || "Google User").trim();
  const providerId = String(googleUser.id || "");

  if (!email) {
    return sendError(res, {
      statusCode: 400,
      message: "Google account email is required"
    });
  }

  let user = await User.findOne({ email }).select("+password");
  if (!user) {
    user = await User.create({
      name,
      email,
      authProvider: "google",
      authProviderId: providerId,
      isVerified: true,
      password: null
    });
  } else if (!user.authProviderId && providerId) {
    user.authProviderId = providerId;
    if (!user.password) {
      user.authProvider = "google";
    }
    await user.save();
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueAuthTokens(req, user._id);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000/index.html";
  const redirectUrl = new URL(frontendUrl);
  redirectUrl.searchParams.set("oauth", "google");
  redirectUrl.searchParams.set("token", tokens.accessToken);
  redirectUrl.searchParams.set("refreshToken", tokens.refreshToken);

  return res.redirect(redirectUrl.toString());
});

module.exports = {
  signup,
  login,
  me,
  refresh,
  logout,
  googleLogin,
  googleCallback
};
