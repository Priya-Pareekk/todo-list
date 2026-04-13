const express = require("express");
const {
  getBillingConfig,
  createOrder,
  verifyPayment,
  getMySubscription
} = require("../controllers/billingController");

const router = express.Router();

router.get("/config", getBillingConfig);
router.get("/subscription", getMySubscription);
router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);

module.exports = router;
