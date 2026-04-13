const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const {
  resolveUserPlan,
  isPremiumPlan,
  FREE_TASK_LIMIT
} = require("../utils/planAccess");

const createTask = asyncHandler(async (req, res) => {
  const { profileId, title, description, priority, status, dueDate, category, tags } = req.body;

  const currentPlan = resolveUserPlan(req.user);
  if (!isPremiumPlan(currentPlan)) {
    const taskCount = await Task.countDocuments({ userId: req.user._id });
    if (taskCount >= FREE_TASK_LIMIT) {
      return sendError(res, {
        statusCode: 403,
        message: "Premium required to add more tasks"
      });
    }
  }

  if (!mongoose.Types.ObjectId.isValid(profileId)) {
    return sendError(res, { statusCode: 400, message: "Invalid profileId" });
  }

  const profile = await Profile.findOne({ _id: profileId, userId: req.user._id });
  if (!profile) {
    const existsForAnotherUser = await Profile.exists({ _id: profileId });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Profile not found for this user" });
  }

  const task = await Task.create({
    userId: req.user._id,
    profileId: profile._id,
    title,
    description,
    priority,
    status,
    dueDate: dueDate || null,
    category,
    tags: tags || [],
    createdBy: req.user._id
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Task created",
    data: task
  });
});

const getAllTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });

  return sendSuccess(res, {
    message: "Tasks fetched",
    data: tasks
  });
});

const getTasksByProfile = asyncHandler(async (req, res) => {
  const { profileId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(profileId)) {
    return sendError(res, { statusCode: 400, message: "Invalid profile id" });
  }

  const ownProfile = await Profile.findOne({ _id: profileId, userId: req.user._id });
  if (!ownProfile) {
    const existsForAnotherUser = await Profile.exists({ _id: profileId });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }
    return sendError(res, { statusCode: 404, message: "Profile not found" });
  }

  const tasks = await Task.find({ userId: req.user._id, profileId }).sort({ createdAt: -1 });

  return sendSuccess(res, {
    message: "Profile tasks fetched",
    data: tasks
  });
});

const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid task id" });
  }

  const task = await Task.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!task) {
    const existsForAnotherUser = await Task.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: task belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Task not found" });
  }

  return sendSuccess(res, {
    message: "Task updated",
    data: task
  });
});

const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid task id" });
  }

  const task = await Task.findOneAndDelete({ _id: id, userId: req.user._id });

  if (!task) {
    const existsForAnotherUser = await Task.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: task belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Task not found" });
  }

  return sendSuccess(res, {
    message: "Task deleted",
    data: { id }
  });
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { statusCode: 400, message: "Invalid task id" });
  }

  const task = await Task.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { status },
    { new: true, runValidators: true }
  );

  if (!task) {
    const existsForAnotherUser = await Task.exists({ _id: id });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: task belongs to another user" });
    }

    return sendError(res, { statusCode: 404, message: "Task not found" });
  }

  return sendSuccess(res, {
    message: "Task status updated",
    data: task
  });
});

module.exports = {
  createTask,
  getAllTasks,
  getTasksByProfile,
  updateTask,
  deleteTask,
  updateTaskStatus
};
