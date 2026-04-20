const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    razorpayOrderId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },
    razorpaySignature: {
      type: String,
      default: "",
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true
    },
    paymentStatus: {
      type: String,
      enum: ["created", "authorized", "captured", "failed", "refunded"],
      default: "created"
    },
    plan: {
      type: String,
      enum: ["free", "premium", "pro", "team", "enterprise"],
      required: true
    },
    billingCycle: {
      type: String,
      enum: ["none", "monthly", "yearly"],
      default: "none"
    },
    notes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    failureReason: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, paymentStatus: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
