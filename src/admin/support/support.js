const helper = require('../../../helper/helper');
const db = require("../../../models");
const SupportTicket = db.support_ticket;
const SupportTicketMessage = db.support_ticket_message;
const Users = db.users;
const { Op } = require("sequelize");

const VALID_STATUSES = ['pending', 'open', 'resolved'];

// Models here have no Sequelize associations (repo-wide convention) - ticket
// rows only carry a plain user_id column, so the owning user's name/email is
// looked up separately and merged in JS rather than via `include`.
async function attachUsers(tickets) {
    const rows = tickets.map(t => (t.toJSON ? t.toJSON() : t));
    const userIds = [...new Set(rows.map(t => t.user_id))];

    const users = await Users.findAll({
        where: { id: userIds },
        attributes: ["id", "name", "email"],
        raw: true,
    });
    const usersById = Object.fromEntries(users.map(u => [u.id, u]));

    return rows.map(t => ({ ...t, user: usersById[t.user_id] || null }));
}

module.exports = function () {
    let module = {};

    module.GetTickets = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const search = req.query.search ? req.query.search.trim() : "";
            const status = req.query.status ? req.query.status.trim() : "";
            const limit = 10;
            const offset = (page - 1) * limit;

            let where = {};

            if (status && VALID_STATUSES.includes(status)) {
                where.status = status;
            }

            if (search) {
                where.subject = { [Op.like]: `%${search}%` };
            }

            const { rows, count } = await SupportTicket.findAndCountAll({
                where,
                order: [["createdAt", "DESC"]],
                limit,
                offset,
            });

            const tickets = await attachUsers(rows);

            return helper.success(res, "All support tickets", {
                tickets,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit) || 1,
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.GetTicketDetail = async (req, res) => {
        try {
            const ticket = await SupportTicket.findOne({ where: { id: req.params.id } });
            if (!ticket) {
                return helper.error(res, "Support ticket not found");
            }

            const [ticketWithUser] = await attachUsers([ticket]);

            const messages = await SupportTicketMessage.findAll({
                where: { ticket_id: ticket.id },
                order: [["createdAt", "ASC"]],
            });

            return helper.success(res, "Support ticket detail", {
                ticket: { ...ticketWithUser, messages },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.UpdateStatus = async (req, res) => {
        try {
            const { status } = req.body;

            if (!VALID_STATUSES.includes(status)) {
                return helper.error(res, "status must be one of: " + VALID_STATUSES.join(", "));
            }

            const ticket = await SupportTicket.findOne({ where: { id: req.params.id } });
            if (!ticket) {
                return helper.error(res, "Support ticket not found");
            }

            const previousStatus = ticket.status;
            await ticket.update({ status });

            const [ticketWithUser] = await attachUsers([ticket]);

            if (previousStatus !== status && ticketWithUser.user) {
                const { message } = await helper.generate_email_content("ticket_status_updated_email", "notification_email", {
                    ticket_subject: ticket.subject,
                    status,
                    cta_link: `${process.env.FRONTEND_URL}/support/${ticket.id}`,
                });
                await helper.send_email({ email: ticketWithUser.user.email, subject: `Your support ticket status was updated to ${status}`, message });
            }

            return helper.success(res, "Support ticket updated", { ticket: ticketWithUser });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.Reply = async (req, res) => {
        try {
            const required = { message: req.body.message };
            await helper.validObject(required, {});

            const ticket = await SupportTicket.findOne({ where: { id: req.params.id } });
            if (!ticket) {
                return helper.error(res, "Support ticket not found");
            }

            const savedMessage = await SupportTicketMessage.create({
                ticket_id: ticket.id,
                sender_type: 'admin',
                message: required.message,
            });

            const ticketOwner = await Users.findOne({
                where: { id: ticket.user_id },
                attributes: ["name", "email"],
                raw: true,
            });

            if (ticketOwner) {
                const { message: emailMessage } = await helper.generate_email_content("ticket_reply_to_user_email", "notification_email", {
                    ticket_subject: ticket.subject,
                    cta_link: `${process.env.FRONTEND_URL}/support/${ticket.id}`,
                });
                await helper.send_email({ email: ticketOwner.email, subject: `New reply on your support ticket: ${ticket.subject}`, message: emailMessage });
            }

            return helper.success(res, "Reply sent", { message: savedMessage });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
