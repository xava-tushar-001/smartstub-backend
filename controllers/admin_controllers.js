const helper = require('../config/helper')
const bcrypt = require('bcrypt');
const Users = require('../models/users')


// Admin Controllers 
module.exports = function () {
    let module = {}

    // Get All Users
    module.get_all_users = async (req, res) => {
        try {
            const required = {
                page: req.query.page,
            };

            const non_required = {
                name: req.query.name,
                email: req.query.email,
            };

            await helper.validObject(required, non_required);

            let page = parseInt(required.page) || 1;
            let limit = 10;
            let skip = (page - 1) * limit;

            let query = {
                user_type: 0,
                // is_active: 1 
            };

            if (non_required.name) {
                query.name = { $regex: non_required.name, $options: 'i' };
            }

            if (non_required.email) {
                query.email = { $regex: non_required.email, $options: 'i' };
            }

            const result = await Users.aggregate([
                { $match: query },
                {
                    $facet: {
                        users: [
                            { $sort: { created_at: -1 } },
                            { $skip: skip },
                            { $limit: limit },
                            { $project: { name: 1, email: 1, created_at: 1, is_active: 1, } }
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
                users,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit)
            };

            return helper.success(res, "All Users", response);
        } catch (error) {
            return helper.error(res, error);
        }
    };


    return module;
}


