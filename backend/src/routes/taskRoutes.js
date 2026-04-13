const express = require("express");
const {
  createTask,
  getAllTasks,
  getTasksByProfile,
  updateTask,
  deleteTask,
  updateTaskStatus
} = require("../controllers/taskController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createTaskValidator,
  updateTaskValidator,
  updateTaskStatusValidator
} = require("../validators/taskValidators");

const router = express.Router();

router.post("/", createTaskValidator, validateRequest, createTask);
router.get("/", getAllTasks);
router.get("/profile/:profileId", getTasksByProfile);
router.put("/:id", updateTaskValidator, validateRequest, updateTask);
router.patch("/:id/status", updateTaskStatusValidator, validateRequest, updateTaskStatus);
router.delete("/:id", deleteTask);

module.exports = router;
