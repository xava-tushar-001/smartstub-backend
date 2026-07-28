const helper = require('../../../helper/helper');
const db = require("../../../models");
const { Op } = require('sequelize');
const PayrollConnection = db.payroll_connection;
const PayrollHistory = db.payroll_history;
const Users = db.users;
const { decrypt } = require('../../../helper/crypto');
const { disconnect: finchDisconnect } = require('../../../helper/finch');
const payrollSync = require('../../users/payroll/payrollSync')();

module.exports = function () {
    let module = {};

    /**
     * Paginated Finch connection health view for the admin panel: which
     * users are connected, to which provider, whether they need to
     * reconnect, and how many pay records have synced so far.
     * GET ?page=&search=&status=(active|disconnected|reauth)
     */
    module.GetConnections = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const search = req.query.search ? req.query.search.trim() : "";
            const statusFilter = req.query.status || "";
            const limit = 10;
            const offset = (page - 1) * limit;

            let where = {};
            if (statusFilter === 'reauth') {
                where.reauth_required = true;
            } else if (statusFilter === 'active' || statusFilter === 'disconnected') {
                where.status = statusFilter;
            }

            // No Sequelize associations are defined in this codebase (every
            // other admin controller does the same manual two-step join),
            // so a text search on the owning user is resolved to a set of
            // user_ids first, then applied to the connection query.
            if (search) {
                const matchingUsers = await Users.findAll({
                    where: {
                        user_type: 0,
                        is_deleted: 0,
                        [Op.or]: [
                            { email: { [Op.like]: `%${search}%` } },
                            { name: { [Op.like]: `%${search}%` } },
                        ],
                    },
                    attributes: ['id'],
                    raw: true,
                });
                const matchingIds = matchingUsers.map((u) => u.id);
                if (matchingIds.length === 0) {
                    return helper.success(res, 'Payroll connections', {
                        connections: [],
                        pagination: { page, limit, total: 0, totalPages: 1 },
                    });
                }
                where.user_id = { [Op.in]: matchingIds };
            }

            const { rows, count } = await PayrollConnection.findAndCountAll({
                where,
                order: [['updatedAt', 'DESC']],
                limit,
                offset,
            });

            const userIds = [...new Set(rows.map((r) => r.user_id))];
            const connectionIds = rows.map((r) => r.id);

            const [users, syncCounts] = await Promise.all([
                userIds.length
                    ? Users.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'], raw: true })
                    : [],
                connectionIds.length
                    ? PayrollHistory.findAll({
                        where: { connection_id: connectionIds },
                        attributes: [
                            'connection_id',
                            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
                        ],
                        group: ['connection_id'],
                        raw: true,
                    })
                    : [],
            ]);
            const userById = new Map(users.map((u) => [u.id, u]));
            const countByConnection = new Map(syncCounts.map((r) => [r.connection_id, Number(r.count)]));

            const connections = rows.map((r) => ({
                id: r.id,
                user: userById.get(r.user_id) || null,
                provider: r.provider,
                status: r.status,
                reauth_required: !!r.reauth_required,
                sync_count: countByConnection.get(r.id) || 0,
                last_sync_at: r.last_sync_at,
                connected_at: r.createdAt,
            }));

            return helper.success(res, 'Payroll connections', {
                connections,
                pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Admin-triggered sync retry for a specific user's connection - reuses
     * the exact same sync path the user's own "Sync Now" button calls.
     */
    module.RetrySync = async (req, res) => {
        try {
            const connection = await PayrollConnection.findOne({ where: { id: req.params.id } });
            if (!connection) {
                return helper.error(res, 'Payroll connection not found');
            }

            const result = await payrollSync.syncPayrollForUser(connection.user_id);
            return helper.success(res, 'Payroll sync retried', result);
        } catch (error) {
            if (error.code === 'REAUTH_REQUIRED') {
                return helper.error(res, error.message, { reauth_required: true });
            }
            return helper.error(res, error.message || 'Could not retry payroll sync.');
        }
    };

    /**
     * Admin-initiated disconnect - e.g. to force a clean reconnect for a
     * user who's stuck. Distinct from a user's own Disconnect action only
     * in who's calling it; behaviour is identical.
     */
    module.Disconnect = async (req, res) => {
        try {
            const connection = await PayrollConnection.findOne({
                where: { id: req.params.id, status: 'active' },
            });
            if (!connection) {
                return helper.error(res, 'No active connection found');
            }

            try {
                const accessToken = decrypt(connection.finch_token);
                await finchDisconnect(accessToken);
            } catch (finchError) {
                console.error('Admin Finch disconnect call failed (continuing to mark disconnected locally):', finchError);
            }

            await connection.update({ status: 'disconnected', reauth_required: false });

            return helper.success(res, 'Payroll connection disconnected');
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
