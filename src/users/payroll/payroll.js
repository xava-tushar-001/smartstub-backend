const helper = require('../../../helper/helper');
const db = require("../../../models");
const PayrollConnection = db.payroll_connection;
const { createConnectSession, exchangeCodeForToken, disconnect: finchDisconnect } = require('../../../helper/finch');
const { encrypt, decrypt } = require('../../../helper/crypto');

const PAID_SUBSCRIPTION_REQUIRED_MESSAGE = 'A paid subscription is required to connect your payroll account.';
const FINCH_PRODUCTS = ['company', 'directory', 'individual', 'employment', 'payment'];

function serializeConnection(connection) {
    if (!connection) return null;
    return {
        provider: connection.provider,
        status: connection.status,
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
            if (req.user.plan !== 'paid') {
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
            if (req.user.plan !== 'paid') {
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

            await connection.update({ status: 'disconnected' });

            return helper.success(res, 'Payroll account disconnected', { connection: serializeConnection(connection) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
