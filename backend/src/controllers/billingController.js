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
  BILLING_CYCLE_NONE,
  BILLING_CYCLE_MONTHLY,
  BILLING_CYCLE_YEARLY,
  normalizePlan,
  normalizeBillingCycle,
  isPremiumPlan,
  resolveUserPlan
} = require("../utils/planAccess");
const { syncUserSubscription } = require("../utils/subscriptionService");

const PLAN_PRICING = {
  free: {
    none: 0
  },
  premium: {
    monthly: 900,
    yearly: 9000
  }
};

const getPlanAmountInPaise = (plan, billingCycle) => {
  const normalizedPlan = normalizePlan(plan);
  const normalizedCycle = normalizeBillingCycle(billingCycle);
  return PLAN_PRICING[normalizedPlan]?.[normalizedCycle] ?? 0;
};

const resolveEndDate = (startDate, billingCycle) => {
  const endDate = new Date(startDate);
  const normalizedCycle = normalizeBillingCycle(billingCycle);

  if (normalizedCycle === BILLING_CYCLE_YEARLY) {
    endDate.setFullYear(endDate.getFullYear() + 1);
    return endDate;
  }

  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const buildSubscriptionData = (subscription) => {
  return {
    plan: normalizePlan(subscription?.plan || FREE_PLAN),
    billingCycle: normalizeBillingCycle(subscription?.billingCycle || BILLING_CYCLE_NONE),
    status: subscription?.status || "active",
    startDate: subscription?.startDate || null,
    endDate: subscription?.endDate || null,
    expiresAt: subscription?.endDate || null,
    isExpired: Boolean(subscription?.isExpired),
    isPremiumAccess: Boolean(subscription?.isPremiumAccess)
  };
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
          billingCycle: BILLING_CYCLE_NONE,
          amount: PLAN_PRICING.free.none,
          currency: "INR"
        },
        premiumMonthly: {
          plan: PREMIUM_PLAN,
          billingCycle: BILLING_CYCLE_MONTHLY,
          amount: PLAN_PRICING.premium.monthly,
          currency: "INR"
        },
        premiumYearly: {
          plan: PREMIUM_PLAN,
          billingCycle: BILLING_CYCLE_YEARLY,
          amount: PLAN_PRICING.premium.yearly,
          currency: "INR"
        }
      }
    }
  });
});

const createOrder = asyncHandler(async (req, res) => {
  const requestedPlan = req.body.plan || PREMIUM_PLAN;
  const requestedCycle = req.body.billingCycle || req.body.cycle || BILLING_CYCLE_MONTHLY;
  const plan = normalizePlan(requestedPlan);
  const billingCycle = normalizeBillingCycle(requestedCycle);

  const currentPlan = req.subscription?.plan || resolveUserPlan(req.user);
  const hasActivePremium = req.subscription?.isPremiumAccess ?? isPremiumPlan(currentPlan);
  if (hasActivePremium) {
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

  if (![BILLING_CYCLE_MONTHLY, BILLING_CYCLE_YEARLY].includes(billingCycle)) {
    return sendError(res, {
      statusCode: 400,
      message: "billingCycle must be either monthly or yearly"
    });
  }

  const amount = getPlanAmountInPaise(plan, billingCycle);
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
        plan,
        billingCycle
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
    billingCycle,
    notes: order.notes || {}
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Razorpay order created",
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      billingCycle
    }
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    plan: requestedPlan,
    billingCycle: requestedCycle
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
    const latestSubscription = await syncUserSubscription(req.user);

    return sendSuccess(res, {
      message: "Payment already verified",
      data: {
        paymentId: payment._id,
        paymentStatus: payment.paymentStatus,
        plan: normalizePlan(payment.plan),
        billingCycle: normalizeBillingCycle(payment.billingCycle),
        isPremium: Boolean(latestSubscription.isPremiumAccess),
        subscription: buildSubscriptionData(latestSubscription),
        user: {
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          subscriptionPlan: req.user.subscriptionPlan,
          subscriptionBillingCycle: req.user.subscriptionBillingCycle,
          subscriptionStatus: req.user.subscriptionStatus,
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
  const billingCycle = normalizeBillingCycle(
    requestedCycle || payment.billingCycle || payment.notes?.billingCycle || BILLING_CYCLE_MONTHLY
  );
  const premiumAccess = isPremiumPlan(plan);

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.plan = plan;
  payment.billingCycle = billingCycle;
  payment.paymentStatus = "captured";
  payment.failureReason = "";
  await payment.save();

  const now = new Date();
  const endDate = resolveEndDate(now, billingCycle);

  await Subscription.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        plan,
        billingCycle,
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
        subscriptionBillingCycle: billingCycle,
        subscriptionStatus: "active",
        isPremium: premiumAccess
      }
    },
    { new: true }
  );

  const syncedSubscription = await syncUserSubscription(updatedUser);

  return sendSuccess(res, {
    message: "Payment verified and subscription upgraded",
    data: {
      paymentId: payment._id,
      paymentStatus: payment.paymentStatus,
      plan,
      billingCycle,
      isPremium: premiumAccess,
      subscription: buildSubscriptionData(syncedSubscription),
      user: {
        userId: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        subscriptionPlan: updatedUser.subscriptionPlan,
        subscriptionBillingCycle: updatedUser.subscriptionBillingCycle,
        subscriptionStatus: updatedUser.subscriptionStatus,
        isPremium: updatedUser.isPremium
      }
    }
  });
});

const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = req.subscription || (await syncUserSubscription(req.user));

  return sendSuccess(res, {
    message: "Subscription fetched",
    data: buildSubscriptionData(subscription)
  });
});

module.exports = {
  getBillingConfig,
  createOrder,
  verifyPayment,
  getMySubscription
};
