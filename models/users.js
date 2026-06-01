const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        maxlength: 120,
    },
    email: {
        type: String,
        maxlength: 120,
    },
    password: {
        type: String,
        maxlength: 90,
    },
    about: {
        type: String,
        maxlength: 180,
    },
    otp_exp_time: {
        type: String,
        maxlength: 16,
    },
    otp: {
        type: Number,
    },
    user_type: {
        type: Number,
        default: 0,
    },
    image: {
        type: String,
        maxlength: 60,
    },
    reset_token: {
        type: String,
        maxlength: 120,
    },
    is_active: {
        type: Number,
        default: 0,
    },
    is_deleted: {
        type: Number,
        default: 0,
    },
},
    {
        timestamps: true,
    }
);

const Users = mongoose.model('users', userSchema);

module.exports = Users;
