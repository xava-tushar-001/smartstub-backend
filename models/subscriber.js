const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        maxlength: 120,
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

const Subscriber = mongoose.model('subscriber', subscriberSchema);

module.exports = Subscriber;
