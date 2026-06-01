const helper = require('../config/helper')
const Users = require('../models/users')
const Subscriber = require('../models/subscriber')
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = function () {

    let module = {}

    module.create_user = async (req, res) => {
        try {

            const required = {
                email: req.body.email
            };

            const non_required = {
            };

            await helper.validObject(required, non_required, 'signup');

            let find_user = await Subscriber.findOne({
                email: required.email,
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


    // login user 
    module.login_user = async (req, res) => {
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


    return module
}