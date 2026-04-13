const FREE_PLAN = "free";
const PREMIUM_PLAN = "premium";

const FREE_PROFILE_LIMIT = 2;
const FREE_TASK_LIMIT = 3;

function normalizePlan(plan) {
  const raw = String(plan || FREE_PLAN).trim().toLowerCase();
  if (["premium", "pro", "team", "enterprise"].includes(raw)) {
    return PREMIUM_PLAN;
  }

  return FREE_PLAN;
}

function isPremiumPlan(plan) {
  return normalizePlan(plan) === PREMIUM_PLAN;
}

function resolveUserPlan(user) {
  if (!user) return FREE_PLAN;

  if (user.isPremium) return PREMIUM_PLAN;
  return normalizePlan(user.subscriptionPlan);
}

module.exports = {
  FREE_PLAN,
  PREMIUM_PLAN,
  FREE_PROFILE_LIMIT,
  FREE_TASK_LIMIT,
  normalizePlan,
  isPremiumPlan,
  resolveUserPlan
};
