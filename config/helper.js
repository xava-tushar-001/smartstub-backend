const Users = require("../models/users")
const sanitizeHtml = require('sanitize-html');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const randomstring = require("randomstring")


module.exports = {


    // Helper function to validate and sanitize data
    validObject: async function (required, non_required, action = null) {

        for (let key in required) {
            required[key] = sanitizeInput(required[key]);
            if (!required[key]) {
                throw new Error(`${key} is required`);
            }
        }

        for (let key in non_required) {
            non_required[key] = sanitizeInput(non_required[key]);
        }

        if (action === 'signup') {
            const data = await Users.findOne({
                email: required.email,
                is_active: 1,
                is_deleted: 0
            })

            if (data) {
                throw new Error('Email is already registered');
            }
        }
        const finalData = { ...required, ...non_required };
        return finalData;
    },


    // Helper function for success response
    success: function (res, message = '', body = {}, code) {
        const statusCode = (typeof code === 'number' && code >= 100 && code < 600) ? code : 200;
        return res.status(statusCode).json({
            success: statusCode >= 200 && statusCode < 300,
            code: statusCode,
            message,
            body
        });
    },


    // Helper function to throw an error
    error: function (res, err, body = {}) {
        console.error('Error:', err);

        let code = 500;
        let message = 'Something went wrong';

        if (typeof err === 'object') {
            code = (err.code && err.code > 1000) ? err.status || 500 : err.code || 501;
            message = err.message || message;
        } else if (typeof err === 'string') {
            code = 400;
            message = err;
        }
        const statusCode = (typeof code === 'number' && code >= 100 && code < 600) ? code : 500;

        return res.status(statusCode).json({
            success: false,
            code: statusCode,
            message,
            body
        });
    },




    // Helper function to verify JWT token
    verify_token: async (req, res, next) => {
        try {
            const authHeader = req.headers['authorization'];
            if (!authHeader) {
                return res.status(401).json({
                    status: false,
                    message: "authorization",
                });
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    status: false,
                    message: "authorization",
                });
            }

            jwt.verify(token, process.env.JWT_KEY, async (err, decoded) => {
                if (err) {
                    return res.status(401).json({
                        status: false,
                        message: "authorization",
                    });
                }

                const user = await Users.findOne({
                    _id: decoded.id,
                    email: decoded.email,
                })

                if (!user) {
                    return res.status(401).json({
                        status: false,
                        message: "authorization",
                    });
                }
                req.user = user;
                next();
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status: false,
                message: "An error occurred during token verification",
                error: error.message,
            });
        }
    },


    // Helper function to upload the file
    file_upload: (files) => {
        const names = [];
        const attachments = Array.isArray(files) ? files : [files];
        attachments.forEach(file => {
            const extension = file.name.split('.').pop();
            const randomName = randomstring.generate(15) + '.' + extension;
            file.mv(`${process.cwd()}/public/images/${randomName}`, (err) => {
                if (err) throw err;
            });
            names.push(randomName);
        });
        return names;
    },


}

function sanitizeInput(input) {
    if (typeof input === 'string') {
        return sanitizeHtml(input, {
            allowedTags: [],
            allowedAttributes: {}
        }).trim();
    }
    return input;
}

