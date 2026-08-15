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
                    "id", "name", "email", "is_active", "status", "suspend_reason", "createdAt",
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
                    "id", "name", "email", "about", "image", "is_active", "status", "suspend_reason", "createdAt",
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
     * Suspends an account: blocks login and invalidates any existing
     * session on the next request (verify_token/verify_admin check
     * `status` too). Separate from is_active (email verification) so a
     * suspension can't be undone by simply registering again.
     */
    module.SuspendUser = async (req, res) => {
        try {
            const required = { reason: req.body.reason };
            await helper.validObject(required, {});

            const user = await Users.findOne({ where: { id: req.params.id, is_deleted: 0, user_type: 0 } });
            if (!user) {
                return helper.error(res, "User not found");
            }
            await user.update({ status: 'suspended', suspend_reason: required.reason });

            const { message } = await helper.generate_email_content("account_suspended_email", "notification_email", {
                reason: required.reason,
            });
            await helper.send_email({ email: user.email, subject: "Your account has been suspended", message });

            return helper.success(res, "User suspended", { id: user.id, status: user.status, suspend_reason: user.suspend_reason });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Reverses SuspendUser.
     */
    module.ReactivateUser = async (req, res) => {
        try {
            const user = await Users.findOne({ where: { id: req.params.id, is_deleted: 0, user_type: 0 } });
            if (!user) {
                return helper.error(res, "User not found");
            }
            await user.update({ status: 'active', suspend_reason: null });

            const { message } = await helper.generate_email_content("account_reactivated_email", "notification_email", {
                cta_link: `${process.env.FRONTEND_URL}`,
            });
            await helper.send_email({ email: user.email, subject: "Your account has been reactivated", message });

            return helper.success(res, "User reactivated", { id: user.id, status: user.status });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Soft-deletes an account (is_deleted = 1). Existing rows in
     * salary_slips/payments/etc. are left in place for record-keeping;
     * the user simply stops showing up in any user-facing or admin list
     * (every query in this codebase already filters on is_deleted: 0) and
     * can no longer log in.
     */
    module.DeleteUser = async (req, res) => {
        try {
            const user = await Users.findOne({ where: { id: req.params.id, is_deleted: 0, user_type: 0 } });
            if (!user) {
                return helper.error(res, "User not found");
            }
            await user.update({ is_deleted: 1 });
            return helper.success(res, "User deleted");
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Manually overrides a user's plan (Free <-> Pro) outside of the normal
     * Stripe checkout/webhook flow - e.g. a goodwill upgrade or a support
     * downgrade. Deliberately does not touch stripe_subscription_id/
     * subscription_status so a real Stripe subscription (if any) is left
     * alone; the next Stripe webhook remains authoritative over those
     * fields.
     * Body: { plan: 'free' | 'paid' }
     */
    module.OverridePlan = async (req, res) => {
        try {
            const plan = req.body.plan;
            if (plan !== 'free' && plan !== 'paid') {
                return helper.error(res, "plan must be 'free' or 'paid'");
            }

            const user = await Users.findOne({ where: { id: req.params.id, is_deleted: 0, user_type: 0 } });
            if (!user) {
                return helper.error(res, "User not found");
            }

            await user.update({ plan });
            return helper.success(res, "Plan updated", { id: user.id, plan: user.plan });
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
