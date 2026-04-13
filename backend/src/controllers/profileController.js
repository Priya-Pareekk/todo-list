const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const {
  resolveUserPlan,
  isPremiumPlan,
  FREE_PROFILE_LIMIT
} = require("../utils/planAccess");

const createProfile = asyncHandler(async (req, res) => {
  const profileName = req.body.profileName || req.body.name;

  const currentPlan = resolveUserPlan(req.user);
  if (!isPremiumPlan(currentPlan)) {
    const profileCount = await Profile.countDocuments({ userId: req.user._id });
    if (profileCount >= FREE_PROFILE_LIMIT) {
      return sendError(res, {
        statusCode: 403,
        message: `Free plan limit reached. You can create up to ${FREE_PROFILE_LIMIT} profiles.`
      });
    }
  }

  const profile = await Profile.create({
    userId: req.user._id,
    profileName,
    role: req.body.role || "user",
    avatar: req.body.avatar || "",
    permissions: Array.isArray(req.body.permissions) && req.body.permissions.length > 0
      ? req.body.permissions
      : undefined
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Profile created",
    data: profile
  });
});

const getAllProfiles = asyncHandler(async (req, res) => {
  const profiles = await Profile.find({ userId: req.user._id }).sort({ createdAt: 1 });

  return sendSuccess(res, {
    message: "Profiles fetched",
    data: profiles
  });
});

const getProfileById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid profile id" });
  }

  const profile = await Profile.findOne({ _id: id, userId: req.user._id });
  if (!profile) {
    const existsForAnotherUser = await Profile.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Profile not found" });
  }

  return sendSuccess(res, {
    message: "Profile fetched",
    data: profile
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid profile id" });
  }

  const payload = { ...req.body };
  if (payload.name && !payload.profileName) {
    payload.profileName = payload.name;
  }
  delete payload.name;

  const profile = await Profile.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    payload,
    { new: true, runValidators: true }
  );

  if (!profile) {
    const existsForAnotherUser = await Profile.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Profile not found" });
  }

  return sendSuccess(res, {
    message: "Profile updated",
    data: profile
  });
});

const deleteProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid profile id" });
  }

  const profile = await Profile.findOne({ _id: id, userId: req.user._id });
  if (!profile) {
    const existsForAnotherUser = await Profile.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Profile not found" });
  }

  await Task.deleteMany({ userId: req.user._id, profileId: profile._id });
  await profile.deleteOne();

  return sendSuccess(res, {
    message: "Profile deleted",
    data: { id }
  });
});

module.exports = {
  createProfile,
  getAllProfiles,
  getProfileById,
  updateProfile,
  deleteProfile
};
