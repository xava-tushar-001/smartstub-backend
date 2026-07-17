const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
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
                attributes: ["id", "name", "email", "is_active", "createdAt"],
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

    return module;
};
