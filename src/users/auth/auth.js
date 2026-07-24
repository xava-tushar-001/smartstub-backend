const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const randomstring = require("randomstring");
const { OAuth2Client } = require('google-auth-library');

const saltRounds = 10;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOtp() {
    // 4-digit numeric OTP (1000-9999) so it never has a leading zero,
    // because the `otp` column is an INTEGER.
    return parseInt(randomstring.generate({ length: 4, charset: "1234567890" }), 10);
}

module.exports = function () {
    let module = {};

    /**
     * Step 1 of account creation.
     * Body: { email, password }
     * Creates (or refreshes) a pending user (is_active = 0), stores a hashed
     * password + OTP, and emails the OTP to the user.
     */
    module.Register = async (req, res) => {
        try {
            const required = {
                email: req.body.email,
                password: req.body.password,
            };

            await helper.validObject(required, {});

            // Already fully registered?
            const activeUser = await Users.findOne({
                where: { email: required.email, is_active: 1, is_deleted: 0 },
                raw: true,
            });
            if (activeUser) {
                return helper.error(res, "Email is Already Registered");
            }

            const hashedPassword = await bcrypt.hash(required.password.toString(), saltRounds);
            const otp = generateOtp();
            const otp_exp_time = (Date.now() + OTP_TTL_MS).toString();

            // Re-use a pending row if one exists, otherwise create a new one.
            const pendingUser = await Users.findOne({
                where: { email: required.email, is_active: 0, is_deleted: 0 },
            });

            if (pendingUser) {
                await pendingUser.update({
                    password: hashedPassword,
                    otp,
                    otp_exp_time,
                });
            } else {
                await Users.create({
                    email: required.email,
                    password: hashedPassword,
                    user_type: 0,
                    is_active: 0,
                    is_deleted: 0,
                    otp,
                    otp_exp_time,
                });
            }

            const { message } = await helper.generate_email_content("otp_email", "otp_email", {
                otp_code: otp,
            });
            await helper.send_email({
                email: required.email,
                subject: "Verify Your Account",
                message,
            });

            return helper.success(res, "OTP sent to your email", { email: required.email });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Step 2 of account creation.
     * Body: { email, otp }
     * Verifies the OTP and activates the account, returning a login token.
     */
    module.VerifyOtp = async (req, res) => {
        try {
            const required = {
                email: req.body.email,
                otp: req.body.otp,
            };

            await helper.validObject(required, {});

            const user = await Users.findOne({
                where: { email: required.email, is_active: 0, is_deleted: 0 },
            });

            if (!user) {
                return helper.error(res, "No pending registration found for this email");
            }

            if (parseInt(required.otp, 10) !== user.otp) {
                return helper.error(res, "Invalid OTP");
            }

            if (!user.otp_exp_time || Date.now() > parseInt(user.otp_exp_time, 10)) {
                return helper.error(res, "OTP has expired. Please request a new one");
            }

            await user.update({
                is_active: 1,
                otp: null,
                otp_exp_time: null,
            });

            const payload = { id: user.id, email: user.email };
            const token = jwt.sign(payload, process.env.JWT_KEY, {
                expiresIn: process.env.JWT_EXPIRY,
            });

            return helper.success(res, "Account created successfully", {
                token,
                user_type: user.user_type,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Resend a fresh OTP to a pending registration.
     * Body: { email }
     */
    module.ResendOtp = async (req, res) => {
        try {
            const required = { email: req.body.email };
            await helper.validObject(required, {});

            const user = await Users.findOne({
                where: { email: required.email, is_active: 0, is_deleted: 0 },
            });

            if (!user) {
                return helper.error(res, "No pending registration found for this email");
            }

            const otp = generateOtp();
            const otp_exp_time = (Date.now() + OTP_TTL_MS).toString();
            await user.update({ otp, otp_exp_time });

            const { message } = await helper.generate_email_content("otp_email", "otp_email", {
                otp_code: otp,
            });
            await helper.send_email({
                email: required.email,
                subject: "Verify Your Account",
                message,
            });

            return helper.success(res, "A new OTP has been sent to your email", {
                email: required.email,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Step 1 of password reset.
     * Body: { email }
     * Sends a fresh OTP to an existing active account. Re-uses the same
     * otp/otp_exp_time columns as registration; calling this again (e.g. for
     * "resend code") simply regenerates and re-sends the OTP.
     */
    module.ForgotPassword = async (req, res) => {
        try {
            const required = { email: req.body.email };
            await helper.validObject(required, {});

            const user = await Users.findOne({
                where: { email: required.email, is_active: 1, is_deleted: 0 },
            });

            if (!user) {
                return helper.error(res, "No account found with this email");
            }

            const otp = generateOtp();
            const otp_exp_time = (Date.now() + OTP_TTL_MS).toString();
            await user.update({ otp, otp_exp_time });

            const { message } = await helper.generate_email_content("reset_password_otp_email", "otp_email", {
                otp_code: otp,
            });
            await helper.send_email({
                email: required.email,
                subject: "Reset Your Password",
                message,
            });

            return helper.success(res, "A password reset code has been sent to your email", {
                email: required.email,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Step 2 of password reset.
     * Body: { email, otp, password }
     * Verifies the OTP and, if valid and unexpired, sets the new password.
     */
    module.ResetPassword = async (req, res) => {
        try {
            const required = {
                email: req.body.email,
                otp: req.body.otp,
                password: req.body.password,
            };

            await helper.validObject(required, {});

            const user = await Users.findOne({
                where: { email: required.email, is_active: 1, is_deleted: 0 },
            });

            if (!user) {
                return helper.error(res, "No account found with this email");
            }

            if (parseInt(required.otp, 10) !== user.otp) {
                return helper.error(res, "Invalid OTP");
            }

            if (!user.otp_exp_time || Date.now() > parseInt(user.otp_exp_time, 10)) {
                return helper.error(res, "OTP has expired. Please request a new one");
            }

            const hashedPassword = await bcrypt.hash(required.password.toString(), saltRounds);
            await user.update({
                password: hashedPassword,
                otp: null,
                otp_exp_time: null,
            });

            return helper.success(res, "Password reset successfully");
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Sign in / sign up with Google.
     * Body: { credential } (the ID token from Google Identity Services)
     * Verifies the token, then finds-or-creates the user. Google has already
     * verified the email, so the account is activated immediately.
     */
    module.GoogleLogin = async (req, res) => {
        try {
            const required = { credential: req.body.credential };
            await helper.validObject(required, {});

            const ticket = await googleClient.verifyIdToken({
                idToken: required.credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            if (!payload || !payload.email_verified) {
                return helper.error(res, "Google account email is not verified");
            }

            let user = await Users.findOne({
                where: { email: payload.email, is_deleted: 0 },
            });

            if (user) {
                if (!user.is_active) {
                    await user.update({
                        is_active: 1,
                        name: user.name || payload.name,
                        otp: null,
                        otp_exp_time: null,
                    });
                }
            } else {
                user = await Users.create({
                    name: payload.name,
                    email: payload.email,
                    user_type: 0,
                    is_active: 1,
                    is_deleted: 0,
                });
            }

            const jwtPayload = { id: user.id, email: user.email };
            const token = jwt.sign(jwtPayload, process.env.JWT_KEY, {
                expiresIn: process.env.JWT_EXPIRY,
            });

            return helper.success(res, "Logged in with Google successfully", {
                token,
                user_type: user.user_type,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
