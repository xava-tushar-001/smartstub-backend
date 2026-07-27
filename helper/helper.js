const db = require('../models')
const Users = db.users
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload')
const randomstring = require("randomstring")
const sanitizeHtml = require('sanitize-html');
const templates = require('../notifications/email_templates');

let resendClient = null;
function getResendClient() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
    }
    if (!resendClient) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return resendClient;
}



module.exports = {


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
                where: {
                    email: required.email,
                    is_active: 1,
                    is_deleted: 0
                },
                raw: true
            })

            if (data) {
                throw new Error('Email is already registered');
            }
        }
        const finalData = { ...required, ...non_required };
        return finalData;
    },


    send_email: async (data) => {
        try {
            if (process.env.EMAIL_SEND == 1) {
                const resend = getResendClient();
                const { data: result, error } = await resend.emails.send({
                    from: process.env.EMAIL_FROM || 'SmartStub <onboarding@resend.dev>',
                    to: data.email,
                    subject: data.subject,
                    html: data.message,
                });

                if (error) {
                    console.error('Error sending email:', error);
                    return false;
                }
                console.log('Email sent successfully:', result?.id);
            } else {
                console.log("Email not sent:");
                return true;
            }

            return true;
        } catch (error) {
            console.error("Error sending email:", error);
        }
    },


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
                    where: {
                        id: decoded.id,
                        email: decoded.email,
                    },
                    raw: true,
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


    /**
     * Same as verify_token, but additionally requires the caller's
     * user_type to be an admin (1). Use this for /admin/* routes so a
     * regular user's token can't read other users' billing/payment data.
     */
    verify_admin: async (req, res, next) => {
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
                    where: {
                        id: decoded.id,
                        email: decoded.email,
                    },
                    raw: true,
                })

                if (!user || user.user_type !== 1) {
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


    success: function (res, message = '', body = {}, code) {
        const statusCode = (typeof code === 'number' && code >= 100 && code < 600) ? code : 200;
        return res.status(statusCode).json({
            success: statusCode >= 200 && statusCode < 300,
            code: statusCode,
            message,
            body
        });
    },


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


    generate_email_content: async (templateKey, templateStyle, replacements) => {
        const allTemplates = await loadEmailTemplates();
        const emailTemplate = allTemplates[templateKey];
        if (!emailTemplate) throw new Error(`Template key "${templateKey}" not found in JSON`);
        const messageContent = replacePlaceholders(emailTemplate, replacements);
        const htmlMessage = templates[templateStyle](messageContent);
        return { message: htmlMessage };
    }


}


//  other helper functions

function sanitizeInput(input) {
    if (typeof input === 'string') {
        return sanitizeHtml(input, {
            allowedTags: [],
            allowedAttributes: {}
        }).trim();
    }
    return input;
}

async function loadEmailTemplates() {
    const filePath = path.join(__dirname, '../notifications/email_content.json');
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

function replacePlaceholders(text, replacements) {
    const result = {};
    for (const field in text) {
        let value = text[field];
        if (typeof value === 'string') {
            for (const key in replacements) {
                const regex = new RegExp(`\\[${key}\\]`, 'g');
                value = value.replace(regex, replacements[key]);
            }
        }
        result[field] = value;
    }

    return result;
}