/**
 * Validates a single pay statement before it's persisted as a PayrollHistory
 * row. Returns { valid, errors: string[] }. Failures are logged by the
 * caller (payrollSync) with enough context to trace back to the source
 * payment/individual.
 */
function validatePayrollRecord({ grossPay, netPay, currency, payDate }) {
    const errors = [];

    if (typeof grossPay !== 'number' || typeof netPay !== 'number') {
        errors.push('Gross pay and net pay must be numeric.');
    } else if (grossPay < netPay) {
        errors.push(`Gross pay (${grossPay}) must be greater than or equal to net pay (${netPay}).`);
    }

    if (!currency) {
        errors.push('Currency is required.');
    }

    if (!payDate || isNaN(new Date(payDate).getTime())) {
        errors.push('Payment date is missing or invalid.');
    } else if (new Date(payDate).getTime() > Date.now()) {
        errors.push(`Payment date (${payDate}) cannot be in the future.`);
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validatePayrollRecord };
