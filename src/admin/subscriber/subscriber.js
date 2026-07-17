const helper = require('../../../helper/helper')
const db = require("../../../models");
const Users = db.users
const Subscriber = db.subscriber
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");

// Admin Controllers 
module.exports = function () {
    let module = {}

    module.GetSubscriber = async (req, res) => {
        try {
            const non_required = {
                page: req.query.page,
                search: req.query.search,
            };

            await helper.validObject({}, non_required);

            const page = parseInt(non_required.page) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            let where = {
                is_deleted: 0,
            };

            if (non_required.search) {
                where.email = {
                    [Op.like]: `%${non_required.search}%`,
                };
            }

            const { rows, count } = await Subscriber.findAndCountAll({
                where,
                order: [["createdAt", "DESC"]],
                limit,
                offset,
            });

            return helper.success(res, "All Subscribers", {
                subscriber: rows,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.SubscriberGraph = async (req, res) => {
        try {
            const days = parseInt(req.query.days) || 7;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (days - 1));
            startDate.setHours(0, 0, 0, 0);

            const result = await Subscriber.findAll({
                attributes: [
                    [
                        Sequelize.fn("DATE", Sequelize.col("createdAt")),
                        "date",
                    ],
                    [
                        Sequelize.fn("COUNT", Sequelize.col("id")),
                        "count",
                    ],
                ],
                where: {
                    is_deleted: 0,
                    createdAt: {
                        [Sequelize.Op.gte]: startDate,
                    },
                },
                group: [Sequelize.fn("DATE", Sequelize.col("createdAt"))],
                order: [[Sequelize.fn("DATE", Sequelize.col("createdAt")), "ASC"]],
                raw: true,
            });

            return helper.success(res, "Subscriber graph", result);
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
}


