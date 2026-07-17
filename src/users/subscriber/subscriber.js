const helper = require('../../../helper/helper')
const db = require("../../../models");
const Users = db.users
const Subscriber = db.subscriber
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const { Op } = db.Sequelize;
const sequelize = db.sequelize;

module.exports = function () {

    let module = {}

    module.CreateSubscriber = async (req, res) => {
        try {

            const required = {
                email: req.body.email
            };

            const non_required = {
            };

            await helper.validObject(required, non_required);

            let find_user = await Subscriber.findOne({
                where: {
                    email: required.email,
                },
            });

            if (find_user) {
                return helper.success(res, "User already exists", {})
            } else {
                await Subscriber.create({
                    ...required,
                });
            }

            const response = {};

            return helper.success(res, "User Created Successfully", response)
        } catch (error) {
            return helper.error(res, error)
        }
    }




    return module
}