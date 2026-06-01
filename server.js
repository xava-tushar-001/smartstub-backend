const mongoose = require("mongoose");
const Users = require("./models/users");
const bcrypt = require('bcrypt');

// mongoose.set('debug', true);

mongoose.connect(`${process.env.DATABASE}`, {
}).then(async () => {

    const existingAdmin = await Users.findOne({ email: process.env.ADMIN_EMAIL });

    if (!existingAdmin) {

        let hash_password = await bcrypt.hash(process.env.ADMIN_PASS, 10);

        await Users.create({
            name: process.env.ADMIN_NAME,
            email: process.env.ADMIN_EMAIL,
            password: hash_password,
            is_active: "1",
            user_type: "1",
        });

        console.log("Default admin user created.");
    } else {
        console.log("Admin user already exists.");
    }


    console.log("Connected to MongoDB");
}).catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});