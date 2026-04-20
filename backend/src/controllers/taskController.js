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
const {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheInvalidateByPattern
} = require("../config/redis");

const TASKS_CACHE_TTL = 180;

const getTasksAllKey = (userId) => `tasks:${String(userId)}:all`;
const getTasksByProfileKey = (userId, profileId) => `tasks:${String(userId)}:profile:${String(profileId)}`;

const invalidateTaskCaches = async (userId, profileId) => {
  await cacheDel([
    getTasksAllKey(userId),
    profileId ? getTasksByProfileKey(userId, profileId) : null
  ]);
  await cacheInvalidateByPattern(`tasks:${String(userId)}:profile:*`);
};

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

  await invalidateTaskCaches(req.user._id, profile._id);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Task created",
    data: task
  });
});

const getAllTasks = asyncHandler(async (req, res) => {
  const cacheKey = getTasksAllKey(req.user._id);
  const cachedTasks = await cacheGet(cacheKey);

  // Cache hit: return Redis data and skip MongoDB query.
  if (cachedTasks) {
    console.log(`[cache] HIT ${cacheKey}`);
    return sendSuccess(res, {
      message: "Tasks fetched",
      data: cachedTasks
    });
  }

  // Cache miss: fetch from MongoDB, store in Redis, and return.
  console.log(`[cache] MISS ${cacheKey}`);
  const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });

  await cacheSet(cacheKey, tasks, TASKS_CACHE_TTL);

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

  const cacheKey = getTasksByProfileKey(req.user._id, profileId);
  const cachedTasks = await cacheGet(cacheKey);

  // Cache hit: return Redis data and skip MongoDB query.
  if (cachedTasks) {
    console.log(`[cache] HIT ${cacheKey}`);
    return sendSuccess(res, {
      message: "Profile tasks fetched",
      data: cachedTasks
    });
  }

  const ownProfile = await Profile.findOne({ _id: profileId, userId: req.user._id });
  if (!ownProfile) {
    const existsForAnotherUser = await Profile.exists({ _id: profileId });
    if (existsForAnotherUser) {
      return sendError(res, { statusCode: 403, message: "Forbidden: profile belongs to another user" });
    }
    return sendError(res, { statusCode: 404, message: "Profile not found" });
  }

  // Cache miss: fetch from MongoDB, store in Redis, and return.
  console.log(`[cache] MISS ${cacheKey}`);
  const tasks = await Task.find({ userId: req.user._id, profileId }).sort({ createdAt: -1 });

  await cacheSet(cacheKey, tasks, TASKS_CACHE_TTL);

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

  await invalidateTaskCaches(req.user._id, task.profileId);

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

  await invalidateTaskCaches(req.user._id, task.profileId);

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

  await invalidateTaskCaches(req.user._id, task.profileId);

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
