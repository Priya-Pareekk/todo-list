const express = require("express");
const { signup, login, me } = require("../controllers/userController");
const requireUserContext = require("../middlewares/userContext");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireUserContext, me);

module.exports = router;
