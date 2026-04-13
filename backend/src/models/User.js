const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      default: null,
      select: false
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },
    authProviderId: {
      type: String,
      default: null,
      index: true
    },
    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium", "pro", "team", "enterprise"],
      default: "free"
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ authProvider: 1, email: 1 });

module.exports = mongoose.model("User", userSchema);
