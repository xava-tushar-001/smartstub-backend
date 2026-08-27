const db = require('../models');
const { Op } = require('sequelize');
const SalarySlip = db.salary_slip;

// Free: 3 uploads. Paid: 20 uploads per subscription period, regardless of
// which duration tier (1 Month / 6 Months / 1 Year) the subscription is for.
const FREE_LIMIT = 3;
const PAID_LIMIT = 20;
const PLAN_LIMITS = { free: FREE_LIMIT, paid: PAID_LIMIT };

// Paid subscription duration tiers. Each maps to a Stripe Price ID via an
// env var - all tiers share the same upload limit (PAID_LIMIT above), they
// only differ in price/billing interval.
const PLAN_TIERS = {
    monthly: { envVar: 'STRIPE_PRICE_ID_1MONTH', label: '1 Month' },
    '6month': { envVar: 'STRIPE_PRICE_ID_6MONTH', label: '6 Months' },
    '1year': { envVar: 'STRIPE_PRICE_ID_1YEAR', label: '1 Year' },
};

function isValidPlanTier(tier) {
    return Object.prototype.hasOwnProperty.call(PLAN_TIERS, tier);
}

function getPriceIdForTier(tier) {
    const def = PLAN_TIERS[tier];
    return def ? (process.env[def.envVar] || null) : null;
}

// Reverse lookup used by the Stripe webhook: given the Price ID a
// subscription is actually billed against, figure out which of our tiers it
// corresponds to.
function getTierForPriceId(priceId) {
    if (!priceId) return null;
    for (const [tier, def] of Object.entries(PLAN_TIERS)) {
        if (process.env[def.envVar] && process.env[def.envVar] === priceId) {
            return tier;
        }
    }
    return null;
}

function startOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getPlanLimit(plan) {
    return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/**
 * The plan to actually enforce right now. Webhooks are the normal way a
 * lapsed subscription flips `plan` back to 'free', but that's eventual
 * (depends on Stripe delivering/us processing the event) - if
 * `current_period_end` has already passed, treat the user as free
 * regardless of what's still stored, so an expired subscription can never
 * grant paid-tier uploads even during that gap.
 */
function getEffectivePlan(user) {
    if (user.plan === 'paid' && user.current_period_end && new Date(user.current_period_end) < new Date()) {
        return 'free';
    }
    return user.plan || 'free';
}

/**
 * Uploads used in the window that the given plan's quota resets on:
 * - paid: since the current subscription period started (a renewal moves
 *   this forward, so it always grants a fresh PAID_LIMIT - never cumulative
 *   with a prior period's usage).
 * - free (or a paid user with no known period start, e.g. an admin-granted
 *   plan override with no real Stripe subscription): calendar month, same
 *   as before.
 */
async function getUsageForUser(user) {
    const effectivePlan = getEffectivePlan(user);
    const windowStart = effectivePlan === 'paid' && user.current_period_start
        ? new Date(user.current_period_start)
        : startOfMonth();

    const count = await SalarySlip.count({
        where: {
            user_id: user.id,
            createdAt: { [Op.gte]: windowStart },
        },
    });

    return { count, limit: getPlanLimit(effectivePlan), effectivePlan, windowStart };
}

module.exports = {
    PLAN_LIMITS,
    FREE_LIMIT,
    PAID_LIMIT,
    PLAN_TIERS,
    isValidPlanTier,
    getPriceIdForTier,
    getTierForPriceId,
    getPlanLimit,
    getEffectivePlan,
    getUsageForUser,
    startOfMonth,
};
