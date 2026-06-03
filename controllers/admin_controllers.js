const helper = require('../config/helper')
const bcrypt = require('bcrypt');
const Users = require('../models/users')
const Subscriber = require('../models/subscriber')
var jwt = require('jsonwebtoken');

// Admin Controllers 
module.exports = function () {
    let module = {}

    // Get All Users
    module.GetSubscriber = async (req, res) => {
        try {
            const required = {
                page: req.query.page,
            };

            const non_required = {
                search: req.query.search,
            };

            await helper.validObject(required, non_required);

            let page = parseInt(required.page) || 1;
            let limit = 10;
            let skip = (page - 1) * limit;

            let query = {
                is_deleted: 0
            };

            if (non_required.search) {
                query.email = { $regex: non_required.search, $options: 'i' };
            }

            const result = await Subscriber.aggregate([
                { $match: query },
                {
                    $facet: {
                        users: [
                            { $sort: { created_at: -1 } },
                            { $skip: skip },
                            { $limit: limit },
                        ],
                        totalCount: [
                            { $count: "count" }
                        ]
                    }
                }
            ]);

            const users = result[0].users;
            const totalCount = result[0].totalCount[0]?.count || 0;

            const response = {
                subscriber: users,
                pagenation: {
                    page: page,
                    limit: limit,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            };

            return helper.success(res, "All Users", response);
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

            const result = await Subscriber.aggregate([
                {
                    $match: {
                        is_deleted: 0,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$createdAt"
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        _id: 1
                    }
                }
            ]);

            return helper.success(res, "Subscriber graph", result);

        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.LoginAdmin = async (req, res) => {
        try {
            let required = {
                email: req.body.email,
                password: req.body.password
            };

            await helper.validObject(required, {});

            let user = await Users.findOne({
                email: required.email,
                is_active: 1,
                is_deleted: 0

            });

            if (!user) {
                return helper.error(res, "User not found");
            }

            const isPasswordValid = await bcrypt.compare(required.password, user.password);

            if (!isPasswordValid) {
                return helper.error(res, "Invalid password");
            }

            const payload = {
                id: user.id,
                email: user.email,
            };

            const token = jwt.sign(payload, process.env.JWT_KEY, { expiresIn: process.env.JWT_EXPIRY });

            let response = {
                token: token,
                user_type: user.user_type
            }

            return helper.success(res, "User fetched successfully", response);

        } catch (error) {
            return helper.error(res, error);
        }
    }

    return module;
}


