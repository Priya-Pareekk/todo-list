const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true
    },
    userAgent: {
      type: String,
      default: ""
    },
    ipAddress: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
