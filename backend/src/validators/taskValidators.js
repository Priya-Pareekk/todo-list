const { body } = require("express-validator");
const mongoose = require("mongoose");

const createTaskValidator = [
  body("profileId")
    .trim()
    .notEmpty()
    .withMessage("profileId is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("profileId must be a valid object id"),
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ max: 160 })
    .withMessage("Task title must be at most 160 characters"),
  body("priority")
    .optional()
    .isIn(["high", "medium", "low"])
    .withMessage("Invalid priority"),
  body("status")
    .optional()
    .isIn(["active", "completed"])
    .withMessage("Invalid status"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("tags must be an array"),
  body("createdBy")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("createdBy must be a valid object id")
];

const updateTaskValidator = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Task title cannot be empty")
    .isLength({ max: 160 })
    .withMessage("Task title must be at most 160 characters"),
  body("description")
    .optional()
    .isString()
    .withMessage("description must be a string"),
  body("priority")
    .optional()
    .isIn(["high", "medium", "low"])
    .withMessage("Invalid priority"),
  body("status")
    .optional()
    .isIn(["active", "completed"])
    .withMessage("Invalid status"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("tags must be an array")
];

const updateTaskStatusValidator = [
  body("status")
    .trim()
    .notEmpty()
    .withMessage("status is required")
    .isIn(["active", "completed"])
    .withMessage("Invalid status")
];

module.exports = {
  createTaskValidator,
  updateTaskValidator,
  updateTaskStatusValidator
};
