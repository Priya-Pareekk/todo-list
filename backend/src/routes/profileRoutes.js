const express = require("express");
const {
  createProfile,
  getAllProfiles,
  getProfileById,
  updateProfile,
  deleteProfile
} = require("../controllers/profileController");
const validateRequest = require("../middlewares/validateRequest");
const { createProfileValidator, updateProfileValidator } = require("../validators/profileValidators");

const router = express.Router();

router.post("/", createProfileValidator, validateRequest, createProfile);
router.get("/", getAllProfiles);
router.get("/:id", getProfileById);
router.put("/:id", updateProfileValidator, validateRequest, updateProfile);
router.delete("/:id", deleteProfile);

module.exports = router;
