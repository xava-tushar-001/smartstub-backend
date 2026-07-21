const db = require('../models');
const { Op } = require('sequelize');
const SalarySlip = db.salary_slip;

const PLAN_LIMITS = { free: 3, paid: 12 };

function startOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getPlanLimit(plan) {
    return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

async function getMonthlyUploadCount(userId) {
    return SalarySlip.count({
        where: {
            user_id: userId,
            createdAt: { [Op.gte]: startOfMonth() },
        },
    });
}

module.exports = { PLAN_LIMITS, getPlanLimit, getMonthlyUploadCount, startOfMonth };
