const FREE_PLAN = "free";
const PREMIUM_PLAN = "premium";

const BILLING_CYCLE_NONE = "none";
const BILLING_CYCLE_MONTHLY = "monthly";
const BILLING_CYCLE_YEARLY = "yearly";

const FREE_PROFILE_LIMIT = 2;
const FREE_TASK_LIMIT = 3;

function normalizePlan(plan) {
  const raw = String(plan || FREE_PLAN).trim().toLowerCase();
  if (["premium", "premium_monthly", "premium_yearly", "pro", "team", "enterprise"].includes(raw)) {
    return PREMIUM_PLAN;
  }

  return FREE_PLAN;
}

function normalizeBillingCycle(cycle) {
  const raw = String(cycle || BILLING_CYCLE_NONE).trim().toLowerCase();
  if (raw === BILLING_CYCLE_MONTHLY) return BILLING_CYCLE_MONTHLY;
  if (raw === BILLING_CYCLE_YEARLY) return BILLING_CYCLE_YEARLY;
  return BILLING_CYCLE_NONE;
}

function isPremiumPlan(plan) {
  return normalizePlan(plan) === PREMIUM_PLAN;
}

function resolveUserPlan(user) {
  if (!user) return FREE_PLAN;

  if (user.isPremium) return PREMIUM_PLAN;
  return normalizePlan(user.subscriptionPlan);
}

function isPremiumAccess(plan, billingCycle, status) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedCycle = normalizeBillingCycle(billingCycle);
  const normalizedStatus = String(status || "active").trim().toLowerCase();

  return (
    isPremiumPlan(normalizedPlan) &&
    [BILLING_CYCLE_MONTHLY, BILLING_CYCLE_YEARLY].includes(normalizedCycle) &&
    normalizedStatus === "active"
  );
}

module.exports = {
  FREE_PLAN,
  PREMIUM_PLAN,
  BILLING_CYCLE_NONE,
  BILLING_CYCLE_MONTHLY,
  BILLING_CYCLE_YEARLY,
  FREE_PROFILE_LIMIT,
  FREE_TASK_LIMIT,
  normalizePlan,
  normalizeBillingCycle,
  isPremiumPlan,
  isPremiumAccess,
  resolveUserPlan
};
