const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    profileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "user"],
      default: "user"
    },
    avatar: {
      type: String,
      default: ""
    },
    permissions: {
      type: [String],
      default: ["task:create", "task:read", "task:update", "task:delete"]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Backward-compatible aliases so existing frontend/controller usage remains valid.
profileSchema.virtual("user").get(function getUserAlias() {
  return this.userId;
});

profileSchema.virtual("name").get(function getNameAlias() {
  return this.profileName;
});

profileSchema.index({ userId: 1, profileName: 1 }, { unique: true });
profileSchema.index({ userId: 1, role: 1 });

module.exports = mongoose.model("Profile", profileSchema);
