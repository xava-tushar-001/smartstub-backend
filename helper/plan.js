const db = require('../models');
const { Op } = require('sequelize');
const SalarySlip = db.salary_slip;

// Free: 3 uploads. Paid: 3 base + 10 additional per subscription period = 13 total.
const FREE_LIMIT = 3;
const PAID_ADDITIONAL = 10;
const PLAN_LIMITS = { free: FREE_LIMIT, paid: FREE_LIMIT + PAID_ADDITIONAL };

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
 *   this forward, so it always grants a fresh 10 - never cumulative with a
 *   prior period's usage).
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

module.exports = { PLAN_LIMITS, FREE_LIMIT, PAID_ADDITIONAL, getPlanLimit, getEffectivePlan, getUsageForUser, startOfMonth };
