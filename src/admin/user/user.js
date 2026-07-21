const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
const Payment = db.payment;
const SalarySlip = db.salary_slip;
const { Op } = require("sequelize");

// Admin controller: list users created through the sign-up flow.
module.exports = function () {
    let module = {};

    module.GetUsers = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const search = req.query.search ? req.query.search.trim() : "";
            const limit = 10;
            const offset = (page - 1) * limit;

            let where = {
                is_deleted: 0,
                user_type: 0, // regular users only, not admins
            };

            if (search) {
                where[Op.or] = [
                    { email: { [Op.like]: `%${search}%` } },
                    { name: { [Op.like]: `%${search}%` } },
                ];
            }

            const { rows, count } = await Users.findAndCountAll({
                where,
                attributes: [
                    "id", "name", "email", "is_active", "createdAt",
                    "plan", "subscription_status", "current_period_end",
                ],
                order: [["createdAt", "DESC"]],
                limit,
                offset,
            });

            return helper.success(res, "All Users", {
                users: rows,
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

    /**
     * A single user's profile + subscription/plan details.
     */
    module.GetUserDetail = async (req, res) => {
        try {
            const user = await Users.findOne({
                where: { id: req.params.id, is_deleted: 0, user_type: 0 },
                attributes: [
                    "id", "name", "email", "about", "image", "is_active", "createdAt",
                    "plan", "subscription_status", "current_period_end", "stripe_customer_id",
                ],
            });

            if (!user) {
                return helper.error(res, "User not found");
            }

            return helper.success(res, "User detail", { user });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * A user's payment/invoice history.
     */
    module.GetUserPayments = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const { rows, count } = await Payment.findAndCountAll({
                where: { user_id: req.params.id },
                order: [["createdAt", "DESC"]],
                limit,
                offset,
            });

            return helper.success(res, "User payments", {
                payments: rows,
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

    /**
     * A user's salary slip upload history.
     */
    module.GetUserSalarySlips = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const { rows, count } = await SalarySlip.findAndCountAll({
                where: { user_id: req.params.id },
                attributes: { exclude: ["file_data"] },
                order: [["createdAt", "DESC"]],
                limit,
                offset,
            });

            return helper.success(res, "User salary slips", {
                salary_slips: rows,
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

    /**
     * Streams a specific salary slip's original file for a given user (admin view).
     */
    module.GetUserSalarySlipFile = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({
                where: { id: req.params.slipId, user_id: req.params.id },
            });

            if (!slip) {
                return helper.error(res, "Salary slip not found");
            }

            res.set('Content-Type', slip.mime_type);
            res.set('Content-Disposition', `inline; filename="${slip.file_name.replace(/[\r\n"]/g, '')}"`);
            return res.send(slip.file_data);
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
