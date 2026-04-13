const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    plan: {
      type: String,
      enum: ["free", "pro", "team", "enterprise"],
      default: "free"
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired", "trial"],
      default: "active"
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, endDate: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
