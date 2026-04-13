const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active"
    },
    dueDate: {
      type: Date,
      default: null
    },
    category: {
      type: String,
      trim: true,
      default: ""
    },
    tags: {
      type: [String],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Backward-compatible aliases used by existing controller/frontend conventions.
taskSchema.virtual("user").get(function getUserAlias() {
  return this.userId;
});

taskSchema.virtual("profile").get(function getProfileAlias() {
  return this.profileId;
});

taskSchema.index({ userId: 1, profileId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model("Task", taskSchema);
