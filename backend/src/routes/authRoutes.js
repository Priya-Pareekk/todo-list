const express = require("express");
const { signup, login, me, refresh, logout } = require("../controllers/userController");
const requireUserContext = require("../middlewares/userContext");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireUserContext, me);

module.exports = router;
