const helper = require('../../../helper/helper');
const db = require("../../../models");
const PayrollConnection = db.payroll_connection;
const { createConnectSession, exchangeCodeForToken, disconnect: finchDisconnect } = require('../../../helper/finch');
const { encrypt, decrypt } = require('../../../helper/crypto');
const { getEffectivePlan } = require('../../../helper/plan');
const payrollSync = require('./payrollSync')();

const PAID_SUBSCRIPTION_REQUIRED_MESSAGE = 'A paid subscription is required to connect your payroll account.';
const FINCH_PRODUCTS = ['company', 'directory', 'individual', 'employment', 'payment', 'pay_statement'];

function serializeConnection(connection) {
    if (!connection) return null;
    return {
        provider: connection.provider,
        status: connection.status,
        reauth_required: !!connection.reauth_required,
        last_sync_at: connection.last_sync_at,
        connected_at: connection.createdAt,
    };
}

module.exports = function () {
    let module = {};

    /**
     * Creates a Finch Connect session for the frontend SDK to open.
     * Pro-only - enforced here, not just hidden in the UI.
     */
    module.CreateSession = async (req, res) => {
        try {
            if (getEffectivePlan(req.user) !== 'paid') {
                return helper.error(res, PAID_SUBSCRIPTION_REQUIRED_MESSAGE, { subscription_required: true });
            }

            const session = await createConnectSession({
                customerId: req.user.id,
                customerName: req.user.name || req.user.email,
                products: FINCH_PRODUCTS,
                sandbox: process.env.FINCH_SANDBOX !== '0',
            });

            return helper.success(res, 'Connect session created', { session_id: session.session_id });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Finishes a Finch Connect session: exchanges the authorization code for
     * an access token and stores the connection (encrypted). Pro-only -
     * enforced here server-side, not just hidden in the UI.
     * Body: { code }
     */
    module.Connect = async (req, res) => {
        try {
            if (getEffectivePlan(req.user) !== 'paid') {
                return helper.error(res, PAID_SUBSCRIPTION_REQUIRED_MESSAGE, { subscription_required: true });
            }

            const required = { code: req.body.code };
            await helper.validObject(required, {});

            const tokenResponse = await exchangeCodeForToken(required.code);
            const accessToken = tokenResponse.access_token;
            if (!accessToken) {
                return helper.error(res, 'Finch did not return an access token');
            }

            const encryptedToken = encrypt(accessToken);
            const connectionFields = {
                provider: tokenResponse.provider_id || null,
                finch_account_id: tokenResponse.connection_id || null,
                finch_token: encryptedToken,
                status: 'active',
                reauth_required: false,
                last_sync_at: new Date(),
            };

            const [connection] = await PayrollConnection.findOrCreate({
                where: { user_id: req.user.id },
                defaults: { user_id: req.user.id, ...connectionFields },
            });
            await connection.update(connectionFields);

            return helper.success(res, 'Payroll account connected', { connection: serializeConnection(connection) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Current connection status for the caller (owner only).
     */
    module.GetStatus = async (req, res) => {
        try {
            const connection = await PayrollConnection.findOne({ where: { user_id: req.user.id } });
            return helper.success(res, 'Payroll connection status', { connection: serializeConnection(connection) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Revokes the stored Finch token and marks the connection disconnected.
     */
    module.Disconnect = async (req, res) => {
        try {
            const connection = await PayrollConnection.findOne({
                where: { user_id: req.user.id, status: 'active' },
            });

            if (!connection) {
                return helper.error(res, 'No active payroll connection found');
            }

            try {
                const accessToken = decrypt(connection.finch_token);
                await finchDisconnect(accessToken);
            } catch (finchError) {
                console.error('Finch disconnect call failed (continuing to mark disconnected locally):', finchError);
            }

            await connection.update({ status: 'disconnected', reauth_required: false });

            return helper.success(res, 'Payroll account disconnected', { connection: serializeConnection(connection) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Runs PayrollSync for the caller: fetches employee/employment/pay-
     * statement data from Finch, validates it, stores new PayrollHistory
     * rows (skipping duplicates), and runs SalaryComparison on each new
     * record. Pro-only - enforced here, not just hidden in the UI.
     */
    module.Sync = async (req, res) => {
        try {
            if (getEffectivePlan(req.user) !== 'paid') {
                return helper.error(res, PAID_SUBSCRIPTION_REQUIRED_MESSAGE, { subscription_required: true });
            }

            const result = await payrollSync.syncPayrollForUser(req.user.id);
            return helper.success(res, 'Payroll data synced', result);
        } catch (error) {
            if (error.code === 'REAUTH_REQUIRED') {
                return helper.error(res, error.message, { reauth_required: true });
            }
            if (error.code === 'NO_CONNECTION') {
                return helper.error(res, error.message, { no_connection: true });
            }
            return helper.error(res, error.message || 'Could not sync payroll data.');
        }
    };

    /**
     * Paginated payroll history for the caller (owner only), with each
     * record's stored SalaryComparison attached where one exists.
     */
    module.GetHistory = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const { rows, count } = await db.payroll_history.findAndCountAll({
                where: { user_id: req.user.id },
                order: [['pay_date', 'DESC'], ['id', 'DESC']],
                limit,
                offset,
            });

            const ids = rows.map((r) => r.id);
            const comparisons = ids.length
                ? await db.payroll_comparison.findAll({ where: { current_payroll_id: ids } })
                : [];
            const comparisonByPayrollId = new Map(comparisons.map((c) => [c.current_payroll_id, c]));

            const records = rows.map((r) => ({
                ...r.toJSON(),
                comparison: comparisonByPayrollId.get(r.id) || null,
            }));

            return helper.success(res, 'Payroll history', {
                records,
                pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
