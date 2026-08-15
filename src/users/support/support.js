const helper = require('../../../helper/helper');
const db = require("../../../models");
const SupportTicket = db.support_ticket;
const SupportTicketMessage = db.support_ticket_message;

module.exports = function () {
    let module = {};

    module.Create = async (req, res) => {
        try {
            const required = {
                subject: req.body.subject,
                description: req.body.description,
            };

            await helper.validObject(required, {});

            const ticket = await SupportTicket.create({
                user_id: req.user.id,
                subject: required.subject,
                description: required.description,
                status: 'pending',
            });

            const { message } = await helper.generate_email_content("new_ticket_email", "notification_email", {
                user_name: req.user.name,
                user_email: req.user.email,
                ticket_subject: ticket.subject,
                cta_link: `${process.env.ADMIN_URL}/tickets/${ticket.id}`,
            });
            await helper.send_email({ email: process.env.ADMIN_EMAIL, subject: `New Support Ticket: ${ticket.subject}`, message });

            return helper.success(res, "Support ticket created", { ticket });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.List = async (req, res) => {
        try {
            const tickets = await SupportTicket.findAll({
                where: { user_id: req.user.id },
                order: [["createdAt", "DESC"]],
            });

            return helper.success(res, "Support tickets", { tickets });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.GetOne = async (req, res) => {
        try {
            const ticket = await SupportTicket.findOne({
                where: { id: req.params.id, user_id: req.user.id },
            });

            if (!ticket) {
                return helper.error(res, "Support ticket not found");
            }

            const messages = await SupportTicketMessage.findAll({
                where: { ticket_id: ticket.id },
                order: [["createdAt", "ASC"]],
            });

            return helper.success(res, "Support ticket detail", {
                ticket: { ...ticket.toJSON(), messages },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.AddMessage = async (req, res) => {
        try {
            const required = { message: req.body.message };
            await helper.validObject(required, {});

            const ticket = await SupportTicket.findOne({
                where: { id: req.params.id, user_id: req.user.id },
            });

            if (!ticket) {
                return helper.error(res, "Support ticket not found");
            }

            const savedMessage = await SupportTicketMessage.create({
                ticket_id: ticket.id,
                sender_type: 'user',
                message: required.message,
            });

            const { message: emailMessage } = await helper.generate_email_content("ticket_reply_to_admin_email", "notification_email", {
                user_name: req.user.name,
                user_email: req.user.email,
                ticket_subject: ticket.subject,
                cta_link: `${process.env.ADMIN_URL}/tickets/${ticket.id}`,
            });
            await helper.send_email({ email: process.env.ADMIN_EMAIL, subject: `New reply on ticket: ${ticket.subject}`, message: emailMessage });

            return helper.success(res, "Message sent", { message: savedMessage });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
