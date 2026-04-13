const { body } = require("express-validator");

const createProfileValidator = [
  body("profileName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Profile name is required")
    .isLength({ max: 100 })
    .withMessage("Profile name must be at most 100 characters"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Profile name is required")
    .isLength({ max: 100 })
    .withMessage("Profile name must be at most 100 characters"),
  body("role")
    .optional()
    .isIn(["owner", "admin", "member", "user"])
    .withMessage("Invalid profile role"),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("permissions must be an array")
];

const updateProfileValidator = [
  body("profileName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Profile name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Profile name must be at most 100 characters"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Profile name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Profile name must be at most 100 characters"),
  body("role")
    .optional()
    .isIn(["owner", "admin", "member", "user"])
    .withMessage("Invalid profile role"),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("permissions must be an array")
];

module.exports = {
  createProfileValidator,
  updateProfileValidator
};
