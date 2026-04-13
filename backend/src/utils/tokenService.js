const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const getAccessSecret = () => process.env.JWT_SECRET;
const getAccessExpiresIn = () => process.env.JWT_EXPIRES_IN || "1d";
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const getRefreshExpiresIn = () => process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const toTokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const parseExpiryToDate = (expiresIn) => {
  const now = Date.now();
  if (typeof expiresIn === "number") {
    return new Date(now + expiresIn * 1000);
  }

  const value = String(expiresIn).trim();
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(now + amount * factors[unit]);
};

const buildAccessToken = (userId) => {
  const secret = getAccessSecret();
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign({ sub: userId, type: "access" }, secret, { expiresIn: getAccessExpiresIn() });
};

const buildRefreshToken = (userId) => {
  const secret = getRefreshSecret();
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET/JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign({ sub: userId, type: "refresh" }, secret, { expiresIn: getRefreshExpiresIn() });
};

const verifyRefreshToken = (token) => {
  const secret = getRefreshSecret();
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET/JWT_SECRET is missing in environment variables.");
  }

  return jwt.verify(token, secret);
};

module.exports = {
  toTokenHash,
  parseExpiryToDate,
  buildAccessToken,
  buildRefreshToken,
  verifyRefreshToken,
  getRefreshExpiresIn
};
