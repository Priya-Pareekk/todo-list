const Subscription = require("../models/Subscription");
const {
  FREE_PLAN,
  BILLING_CYCLE_NONE,
  normalizePlan,
  normalizeBillingCycle,
  isPremiumAccess
} = require("./planAccess");

const FREE_STATUS = "active";

function toSubscriptionSnapshot({
  plan = FREE_PLAN,
  billingCycle = BILLING_CYCLE_NONE,
  status = FREE_STATUS,
  startDate = null,
  endDate = null,
  isPremium = false
}) {
  return {
    plan: normalizePlan(plan),
    billingCycle: normalizeBillingCycle(billingCycle),
    status,
    startDate,
    endDate,
    isPremiumAccess: Boolean(isPremium),
    isExpired: String(status || "").toLowerCase() === "expired"
  };
}

async function markUserAsFree(user) {
  const needsUpdate =
    normalizePlan(user.subscriptionPlan) !== FREE_PLAN ||
    normalizeBillingCycle(user.subscriptionBillingCycle) !== BILLING_CYCLE_NONE ||
    user.isPremium ||
    String(user.subscriptionStatus || "").toLowerCase() !== FREE_STATUS;

  if (!needsUpdate) return user;

  user.subscriptionPlan = FREE_PLAN;
  user.subscriptionBillingCycle = BILLING_CYCLE_NONE;
  user.subscriptionStatus = FREE_STATUS;
  user.isPremium = false;
  await user.save();
  return user;
}

async function syncUserSubscription(user) {
  const subscription = await Subscription.findOne({ userId: user._id }).sort({ updatedAt: -1 });

  if (!subscription) {
    await markUserAsFree(user);
    return toSubscriptionSnapshot({
      plan: user.subscriptionPlan,
      billingCycle: user.subscriptionBillingCycle,
      status: user.subscriptionStatus,
      startDate: null,
      endDate: null,
      isPremium: user.isPremium
    });
  }

  subscription.plan = normalizePlan(subscription.plan);
  subscription.billingCycle = normalizeBillingCycle(subscription.billingCycle);

  const hasExpired =
    subscription.endDate &&
    String(subscription.status || "").toLowerCase() === "active" &&
    new Date(subscription.endDate).getTime() <= Date.now();

  if (hasExpired) {
    subscription.status = "expired";
    subscription.plan = FREE_PLAN;
    subscription.billingCycle = BILLING_CYCLE_NONE;
    subscription.isPremiumAccess = false;
    await subscription.save();
  }

  const premiumAccess = isPremiumAccess(subscription.plan, subscription.billingCycle, subscription.status);

  const userNeedsSync =
    normalizePlan(user.subscriptionPlan) !== normalizePlan(subscription.plan) ||
    normalizeBillingCycle(user.subscriptionBillingCycle) !== normalizeBillingCycle(subscription.billingCycle) ||
    String(user.subscriptionStatus || "").toLowerCase() !== String(subscription.status || "").toLowerCase() ||
    Boolean(user.isPremium) !== premiumAccess;

  if (userNeedsSync) {
    user.subscriptionPlan = normalizePlan(subscription.plan);
    user.subscriptionBillingCycle = normalizeBillingCycle(subscription.billingCycle);
    user.subscriptionStatus = subscription.status;
    user.isPremium = premiumAccess;
    await user.save();
  }

  return toSubscriptionSnapshot({
    plan: subscription.plan,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    isPremium: premiumAccess
  });
}

module.exports = {
  syncUserSubscription,
  toSubscriptionSnapshot
};
