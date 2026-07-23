const db = require('../../../models');
const { Op } = require('sequelize');
const PayrollHistory = db.payroll_history;
const PayrollComparison = db.payroll_comparison;

function directionOf(change) {
    if (change > 0) return 'increase';
    if (change < 0) return 'decrease';
    return 'unchanged';
}

function formatMoney(cents, currency) {
    return `${(Math.abs(cents) / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
}

function buildSummary({ grossChange, netChange, bonusChange, overtimeChange, currency }) {
    const parts = [];
    if (grossChange !== 0) {
        parts.push(`Gross pay ${grossChange > 0 ? 'increased' : 'decreased'} by ${formatMoney(grossChange, currency)}`);
    }
    if (netChange !== 0) {
        parts.push(`Net pay ${netChange > 0 ? 'increased' : 'decreased'} by ${formatMoney(netChange, currency)}`);
    }
    if (bonusChange !== 0) {
        parts.push(`Bonus ${bonusChange > 0 ? 'increased' : 'decreased'} by ${formatMoney(bonusChange, currency)}`);
    }
    if (overtimeChange !== 0) {
        parts.push(`Overtime pay ${overtimeChange > 0 ? 'increased' : 'decreased'} by ${formatMoney(overtimeChange, currency)}`);
    }
    if (parts.length === 0) return 'No change from the previous pay period.';
    return `${parts.join('. ')}.`;
}

module.exports = function () {
    let module = {};

    /**
     * Compares a newly-inserted PayrollHistory record against the most
     * recent prior record for the same individual, and stores the result.
     * Returns null if there's no prior record to compare against (first
     * synced record for this individual).
     */
    module.compareAndStore = async ({ userId, connectionId, individualId, current }) => {
        const previous = await PayrollHistory.findOne({
            where: {
                user_id: userId,
                finch_individual_id: individualId,
                id: { [Op.ne]: current.id },
            },
            order: [['pay_date', 'DESC'], ['id', 'DESC']],
        });

        if (!previous) return null;

        const grossChange = current.gross_pay - previous.gross_pay;
        const netChange = current.net_pay - previous.net_pay;
        const bonusChange = current.bonus_amount - previous.bonus_amount;
        const overtimeChange = current.overtime_amount - previous.overtime_amount;

        return PayrollComparison.create({
            user_id: userId,
            connection_id: connectionId,
            previous_payroll_id: previous.id,
            current_payroll_id: current.id,
            gross_change: grossChange,
            gross_direction: directionOf(grossChange),
            net_change: netChange,
            net_direction: directionOf(netChange),
            bonus_change: bonusChange,
            bonus_direction: directionOf(bonusChange),
            overtime_change: overtimeChange,
            overtime_direction: directionOf(overtimeChange),
            summary: buildSummary({ grossChange, netChange, bonusChange, overtimeChange, currency: current.currency }),
        });
    };

    return module;
};
