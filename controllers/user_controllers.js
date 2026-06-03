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




    return module
}