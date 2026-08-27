const helper = require('../../../helper/helper');
const db = require("../../../models");
const { Sequelize, Op } = require('sequelize');
const Users = db.users;
const SalarySlip = db.salary_slip;
const PayrollConnection = db.payroll_connection;
const { PLAN_TIERS } = require('../../../helper/plan');

// Earnings are bucketed at one of three granularities. Each entry defines the
// MySQL expression that produces a bucket key, how far back we go, and how the
// key is stepped/labelled when filling gaps (a bucket with no payments still
// has to appear on the chart as a zero, otherwise the x-axis lies).
const EARNING_PERIODS = {
    monthly: { buckets: 12, sql: "DATE_FORMAT(p.createdAt, '%Y-%m')" },
    quarterly: { buckets: 8, sql: "CONCAT(YEAR(p.createdAt), '-Q', QUARTER(p.createdAt))" },
    yearly: { buckets: 5, sql: 'CAST(YEAR(p.createdAt) AS CHAR)' },
};

// Tier keys as stored on users.plan_tier, plus a bucket for paid invoices we
// can't attribute (user downgraded/cancelled, so plan_tier is now null).
const TIER_KEYS = [...Object.keys(PLAN_TIERS), 'unknown'];

const emptyTierMap = () => Object.fromEntries(TIER_KEYS.map((k) => [k, 0]));

/**
 * The ordered list of buckets to render, oldest first, walking back from the
 * current period. Returns { key, label, start } - `start` is the range floor we
 * hand to the query so we never scan the whole payments table.
 */
function buildEarningBuckets(period) {
    const { buckets } = EARNING_PERIODS[period];
    const now = new Date();
    const out = [];

    for (let i = buckets - 1; i >= 0; i--) {
        if (period === 'monthly') {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            out.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(-2)}`,
                start: d,
            });
        } else if (period === 'quarterly') {
            const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
            const quarter = Math.floor(d.getMonth() / 3) + 1;
            const qStart = new Date(d.getFullYear(), (quarter - 1) * 3, 1);
            out.push({
                key: `${qStart.getFullYear()}-Q${quarter}`,
                label: `Q${quarter} '${String(qStart.getFullYear()).slice(-2)}`,
                start: qStart,
            });
        } else {
            const d = new Date(now.getFullYear() - i, 0, 1);
            out.push({ key: String(d.getFullYear()), label: String(d.getFullYear()), start: d });
        }
    }

    return out;
}

function lastSixMonthsRange() {
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
}

function fillLastSixMonths(rowsByKey) {
    const cursor = lastSixMonthsRange();
    const months = [];
    for (let i = 0; i < 6; i++) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            month: cursor.toLocaleString('en-US', { month: 'short' }),
            count: rowsByKey.get(key) || 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

async function monthlyCounts(Model, dateColumn = 'createdAt', where = {}) {
    const rangeStart = lastSixMonthsRange();
    const rows = await Model.findAll({
        where: { ...where, [dateColumn]: { [Op.gte]: rangeStart } },
        attributes: [
            [Sequelize.fn('DATE_FORMAT', Sequelize.col(dateColumn), '%Y-%m'), 'month'],
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        ],
        group: [Sequelize.fn('DATE_FORMAT', Sequelize.col(dateColumn), '%Y-%m')],
        raw: true,
    });
    return fillLastSixMonths(new Map(rows.map((r) => [r.month, Number(r.count)])));
}

module.exports = function () {
    let module = {};

    /**
     * Platform-wide metrics for the admin dashboard: user counts by plan,
     * total salary slips uploaded, payroll connections, plus 6-month trends.
     */
    module.GetDashboardStats = async (req, res) => {
        try {
            const userWhere = { user_type: 0, is_deleted: 0 };

            const [totalUsers, freeUsers, paidUsers, activeUsers, disabledUsers, totalSlips, payrollConnected, payrollReauthRequired] = await Promise.all([
                Users.count({ where: userWhere }),
                Users.count({ where: { ...userWhere, plan: 'free' } }),
                Users.count({ where: { ...userWhere, plan: 'paid' } }),
                Users.count({ where: { ...userWhere, status: 'active' } }),
                Users.count({ where: { ...userWhere, status: 'suspended' } }),
                SalarySlip.count(),
                PayrollConnection.count({ where: { status: 'active' } }),
                PayrollConnection.count({ where: { reauth_required: true } }),
            ]);

            const [monthly_signups, monthly_uploads] = await Promise.all([
                monthlyCounts(Users, 'createdAt', userWhere),
                monthlyCounts(SalarySlip),
            ]);

            return helper.success(res, 'Dashboard stats', {
                totals: {
                    users: totalUsers,
                    free_users: freeUsers,
                    paid_users: paidUsers,
                    active_users: activeUsers,
                    disabled_users: disabledUsers,
                    salary_slips: totalSlips,
                    payroll_connected: payrollConnected,
                    payroll_reauth_required: payrollReauthRequired,
                },
                monthly_signups,
                monthly_uploads,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };


    /**
     * Subscription revenue over time, bucketed monthly / quarterly / yearly and
     * split by the billing tier the paying user is on.
     *
     * `payments` stores no tier of its own, so each invoice is attributed via a
     * join to `users.plan_tier`. That means a user who switched tiers has their
     * whole payment history counted under their CURRENT tier - fine for a trend
     * chart, not a substitute for Stripe's own reporting.
     *
     * Amounts are stored in the smallest currency unit (cents) and returned in
     * major units. Mixed-currency accounts would sum apples and oranges, so the
     * dominant currency is reported alongside for the frontend to label with.
     */
    module.GetEarningsGraph = async (req, res) => {
        try {
            const period = EARNING_PERIODS[req.query.period] ? req.query.period : 'monthly';
            const buckets = buildEarningBuckets(period);
            const rangeStart = buckets[0].start;
            const bucketSql = EARNING_PERIODS[period].sql;

            const [rows, currencyRows] = await Promise.all([
                db.sequelize.query(
                    `SELECT ${bucketSql} AS bucket,
                            COALESCE(u.plan_tier, 'unknown') AS tier,
                            SUM(p.amount) AS amount,
                            COUNT(p.id) AS transactions
                       FROM payments p
                       LEFT JOIN users u ON u.id = p.user_id
                      WHERE p.status = 'paid' AND p.createdAt >= :rangeStart
                      GROUP BY bucket, tier`,
                    { replacements: { rangeStart }, type: Sequelize.QueryTypes.SELECT }
                ),
                db.sequelize.query(
                    `SELECT currency, COUNT(id) AS uses
                       FROM payments
                      WHERE status = 'paid'
                      GROUP BY currency
                      ORDER BY uses DESC
                      LIMIT 1`,
                    { type: Sequelize.QueryTypes.SELECT }
                ),
            ]);

            const byBucket = new Map(buckets.map((b) => [b.key, { ...emptyTierMap(), total: 0, transactions: 0 }]));
            const tierTotals = emptyTierMap();
            let grandTotal = 0;
            let transactions = 0;

            for (const row of rows) {
                const slot = byBucket.get(row.bucket);
                if (!slot) continue;
                // An unrecognised plan_tier (e.g. a tier retired from PLAN_TIERS)
                // still represents real money - fold it into `unknown` rather
                // than dropping it, so the stacked bars match the total.
                const tier = TIER_KEYS.includes(row.tier) ? row.tier : 'unknown';
                const amount = Number(row.amount || 0) / 100;
                const count = Number(row.transactions || 0);

                slot[tier] += amount;
                slot.total += amount;
                slot.transactions += count;
                tierTotals[tier] += amount;
                grandTotal += amount;
                transactions += count;
            }

            const points = buckets.map((b) => ({ period: b.label, key: b.key, ...byBucket.get(b.key) }));

            return helper.success(res, 'Earnings graph', {
                period,
                currency: (currencyRows[0]?.currency || 'usd').toUpperCase(),
                tiers: TIER_KEYS.map((key) => ({ key, label: PLAN_TIERS[key]?.label || 'Unattributed' })),
                points,
                summary: {
                    total: grandTotal,
                    transactions,
                    average: transactions ? grandTotal / transactions : 0,
                    tier_totals: tierTotals,
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
