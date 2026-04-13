const crypto = require("crypto");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { getRazorpayClient, getRazorpayCredentials } = require("../config/razorpay");
const {
  FREE_PLAN,
  PREMIUM_PLAN,
  normalizePlan,
  isPremiumPlan,
  resolveUserPlan
} = require("../utils/planAccess");

const PLAN_PRICING = {
  free: 0,
  premium: 900
};

const getPlanAmountInPaise = (plan) => {
  const normalizedPlan = normalizePlan(plan);
  return PLAN_PRICING[normalizedPlan] ?? 0;
};

const getRazorpayErrorMessage = (error) => {
  const message =
    error?.error?.description ||
    error?.error?.reason ||
    error?.description ||
    error?.message ||
    "Razorpay request failed";

  return String(message);
};

const getBillingConfig = asyncHandler(async (req, res) => {
  const { keyId } = getRazorpayCredentials();

  return sendSuccess(res, {
    message: "Billing config fetched",
    data: {
      keyId,
      plans: {
        free: {
          plan: FREE_PLAN,
          amount: PLAN_PRICING.free,
          currency: "INR"
        },
        premium: {
          plan: PREMIUM_PLAN,
          amount: PLAN_PRICING.premium,
          currency: "INR"
        }
      }
    }
  });
});

const createOrder = asyncHandler(async (req, res) => {
  const requestedPlan = req.body.plan || PREMIUM_PLAN;
  const plan = normalizePlan(requestedPlan);

  if (isPremiumPlan(resolveUserPlan(req.user))) {
    return sendError(res, {
      statusCode: 400,
      message: "Your account is already on premium plan"
    });
  }

  if (plan !== PREMIUM_PLAN) {
    return sendError(res, {
      statusCode: 400,
      message: "Only premium order creation is allowed. Free plan does not require payment."
    });
  }

  const amount = getPlanAmountInPaise(plan);
  if (!amount || amount <= 0) {
    return sendError(res, {
      statusCode: 400,
      message: "Invalid plan amount configuration"
    });
  }

  const razorpay = getRazorpayClient();

  let order;
  const receipt = `rcpt_${Date.now()}`;

  try {
    order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: String(req.user._id),
        plan
      }
    });
  } catch (error) {
    return sendError(res, {
      statusCode: 400,
      message: `Razorpay order creation failed: ${getRazorpayErrorMessage(error)} (receipt=${receipt}, len=${receipt.length})`
    });
  }

  await Payment.create({
    userId: req.user._id,
    razorpayOrderId: order.id,
    amount,
    currency: order.currency,
    paymentStatus: "created",
    plan,
    notes: order.notes || {}
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Razorpay order created",
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan
    }
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    plan: requestedPlan
  } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return sendError(res, {
      statusCode: 400,
      message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
    });
  }

  const payment = await Payment.findOne({
    userId: req.user._id,
    razorpayOrderId: razorpayOrderId
  });

  if (!payment) {
    return sendError(res, {
      statusCode: 404,
      message: "Payment order not found for this user"
    });
  }

  if (payment.paymentStatus === "captured") {
    return sendSuccess(res, {
      message: "Payment already verified",
      data: {
        paymentId: payment._id,
        paymentStatus: payment.paymentStatus,
        plan: normalizePlan(payment.plan),
        isPremium: true,
        user: {
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          subscriptionPlan: req.user.subscriptionPlan,
          isPremium: req.user.isPremium
        }
      }
    });
  }

  const { keySecret } = getRazorpayCredentials();
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    payment.paymentStatus = "failed";
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.failureReason = "Signature verification failed";
    await payment.save();

    return sendError(res, {
      statusCode: 400,
      message: "Payment verification failed. Invalid signature."
    });
  }

  const plan = normalizePlan(requestedPlan || payment.plan || PREMIUM_PLAN);
  const premiumAccess = isPremiumPlan(plan);

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.plan = plan;
  payment.paymentStatus = "captured";
  payment.failureReason = "";
  await payment.save();

  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1);

  await Subscription.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        plan,
        status: "active",
        startDate: now,
        endDate,
        isPremiumAccess: premiumAccess
      }
    },
    { new: true, upsert: true }
  );

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        subscriptionPlan: plan,
        isPremium: premiumAccess
      }
    },
    { new: true }
  );

  return sendSuccess(res, {
    message: "Payment verified and subscription upgraded",
    data: {
      paymentId: payment._id,
      paymentStatus: payment.paymentStatus,
      plan,
      isPremium: premiumAccess,
      user: {
        userId: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        subscriptionPlan: updatedUser.subscriptionPlan,
        isPremium: updatedUser.isPremium
      }
    }
  });
});

const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
  const currentPlan = subscription?.plan || resolveUserPlan(req.user);
  const premiumAccess = subscription?.isPremiumAccess ?? isPremiumPlan(currentPlan);

  return sendSuccess(res, {
    message: "Subscription fetched",
    data: {
      plan: normalizePlan(currentPlan),
      isPremiumAccess: premiumAccess,
      status: subscription?.status || "active",
      startDate: subscription?.startDate || null,
      endDate: subscription?.endDate || null
    }
  });
});

module.exports = {
  getBillingConfig,
  createOrder,
  verifyPayment,
  getMySubscription
};
