const helper = require('../../../helper/helper');
const db = require("../../../models");
const { Sequelize, Op } = require('sequelize');
const Users = db.users;
const SalarySlip = db.salary_slip;
const PayrollConnection = db.payroll_connection;

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

            const [totalUsers, freeUsers, paidUsers, totalSlips, payrollConnected, payrollReauthRequired] = await Promise.all([
                Users.count({ where: userWhere }),
                Users.count({ where: { ...userWhere, plan: 'free' } }),
                Users.count({ where: { ...userWhere, plan: 'paid' } }),
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

    return module;
};
