const db = require('../../../models');
const PayrollConnection = db.payroll_connection;
const PayrollHistory = db.payroll_history;
const { decrypt } = require('../../../helper/crypto');
const finch = require('../../../helper/finch');
const { validatePayrollRecord } = require('../../../helper/payrollValidation');
const salaryComparison = require('./salaryComparison')();

const BONUS_TYPES = ['bonus'];
const OVERTIME_TYPES = ['overtime', 'double_overtime'];

function sumEarnings(earnings, types) {
    return (earnings || [])
        .filter((e) => types.includes(e.type))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function reauthError() {
    const err = new Error('Your payroll connection has expired. Please reconnect your payroll account.');
    err.code = 'REAUTH_REQUIRED';
    return err;
}

module.exports = function () {
    let module = {};

    /**
     * Syncs payroll data for a user's active Finch connection:
     *   1. Fetches payments (payroll runs) for the last 12 months.
     *   2. Fetches pay statements (per-employee breakdown) for those payments.
     *   3. Fetches individual + employment info for enrichment (best-effort).
     *   4. Validates and stores new PayrollHistory rows, skipping duplicates.
     *   5. Runs SalaryComparison for every newly-inserted record.
     *
     * If Finch signals the connection needs reauthentication, the stored
     * connection is marked disconnected and a REAUTH_REQUIRED error is thrown
     * so the caller can prompt the user to reconnect.
     */
    module.syncPayrollForUser = async (userId) => {
        const connection = await PayrollConnection.findOne({ where: { user_id: userId, status: 'active' } });
        if (!connection) {
            const err = new Error('No active payroll connection found. Please connect your payroll account first.');
            err.code = 'NO_CONNECTION';
            throw err;
        }

        const accessToken = decrypt(connection.finch_token);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        let payments;
        try {
            payments = await finch.getPayments(accessToken, {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
            });
        } catch (error) {
            if (error instanceof finch.FinchReauthRequiredError) {
                await connection.update({ status: 'disconnected', reauth_required: true });
                throw reauthError();
            }
            console.error('PayrollSync: Finch getPayments failed:', error);
            const wrapped = new Error('Could not fetch payroll data from Finch. Please try again shortly.');
            wrapped.code = 'FINCH_ERROR';
            throw wrapped;
        }

        if (!Array.isArray(payments) || payments.length === 0) {
            await connection.update({ last_sync_at: new Date() });
            return { synced: 0, skipped_duplicates: 0, skipped_invalid: 0, comparisons: [] };
        }

        let statements;
        try {
            statements = await finch.getPayStatements(accessToken, payments.map((p) => p.id));
        } catch (error) {
            if (error instanceof finch.FinchReauthRequiredError) {
                await connection.update({ status: 'disconnected', reauth_required: true });
                throw reauthError();
            }
            console.error('PayrollSync: Finch getPayStatements failed:', error);
            const wrapped = new Error('Could not fetch pay statements from Finch. Please try again shortly.');
            wrapped.code = 'FINCH_ERROR';
            throw wrapped;
        }

        const paymentById = new Map(payments.map((p) => [p.id, p]));
        const individualIds = [...new Set(statements.map((s) => s.individual_id))];

        // Employee name + employment details are enrichment only - a failure
        // here shouldn't abort the sync, since the pay statement data itself
        // is already fetched successfully.
        let individualInfo = {};
        let employmentInfo = {};
        try {
            individualInfo = await finch.getIndividuals(accessToken, individualIds);
        } catch (error) {
            console.error('PayrollSync: Finch getIndividuals enrichment failed (continuing without names):', error);
        }
        try {
            employmentInfo = await finch.getEmployments(accessToken, individualIds);
        } catch (error) {
            console.error('PayrollSync: Finch getEmployments enrichment failed (continuing without titles):', error);
        }

        let synced = 0;
        let skippedDuplicates = 0;
        let skippedInvalid = 0;
        const comparisons = [];

        for (const statement of statements) {
            const payment = paymentById.get(statement.payment_id);
            if (!payment) continue;

            const existing = await PayrollHistory.findOne({
                where: {
                    user_id: userId,
                    finch_payment_id: statement.payment_id,
                    finch_individual_id: statement.individual_id,
                },
            });
            if (existing) {
                skippedDuplicates++;
                continue;
            }

            const grossPay = statement.gross_pay?.amount;
            const netPay = statement.net_pay?.amount;
            const currency = statement.gross_pay?.currency || statement.net_pay?.currency;
            const payDate = payment.pay_date;

            const { valid, errors } = validatePayrollRecord({ grossPay, netPay, currency, payDate });
            if (!valid) {
                skippedInvalid++;
                console.error('PayrollSync: record failed validation, skipping:', {
                    userId,
                    payment_id: statement.payment_id,
                    individual_id: statement.individual_id,
                    errors,
                });
                continue;
            }

            const individual = individualInfo[statement.individual_id];
            const employment = employmentInfo[statement.individual_id];
            const employeeName = individual
                ? [individual.first_name, individual.last_name].filter(Boolean).join(' ') || null
                : null;

            let record;
            try {
                record = await PayrollHistory.create({
                    user_id: userId,
                    connection_id: connection.id,
                    finch_payment_id: statement.payment_id,
                    finch_individual_id: statement.individual_id,
                    employee_name: employeeName,
                    job_title: employment?.title || null,
                    employment_status: employment?.employment_status || null,
                    pay_period_start: payment.pay_period?.start_date || null,
                    pay_period_end: payment.pay_period?.end_date || null,
                    pay_date: payDate,
                    gross_pay: grossPay,
                    net_pay: netPay,
                    bonus_amount: sumEarnings(statement.earnings, BONUS_TYPES),
                    overtime_amount: sumEarnings(statement.earnings, OVERTIME_TYPES),
                    currency,
                    earnings: statement.earnings || [],
                });
            } catch (dbError) {
                // Unique-constraint race (e.g. a concurrent sync) - treat as a skipped duplicate.
                if (dbError.name === 'SequelizeUniqueConstraintError') {
                    skippedDuplicates++;
                    continue;
                }
                throw dbError;
            }

            synced++;

            const comparison = await salaryComparison.compareAndStore({
                userId,
                connectionId: connection.id,
                individualId: statement.individual_id,
                current: record,
            });
            if (comparison) comparisons.push(comparison);
        }

        await connection.update({ last_sync_at: new Date() });

        return { synced, skipped_duplicates: skippedDuplicates, skipped_invalid: skippedInvalid, comparisons };
    };

    return module;
};
