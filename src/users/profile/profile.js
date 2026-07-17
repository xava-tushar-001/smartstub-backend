const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;

module.exports = function () {
    let module = {};

    module.GetProfile = async (req, res) => {
        try {
            const user = await Users.findOne({
                where: { id: req.user.id },
                attributes: ["id", "name", "email", "about", "image", "createdAt"],
            });

            if (!user) {
                return helper.error(res, "User not found");
            }

            return helper.success(res, "Profile fetched successfully", { user });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    module.UpdateProfile = async (req, res) => {
        try {
            const non_required = {
                name: req.body.name,
                about: req.body.about,
            };

            await helper.validObject({}, non_required);

            const user = await Users.findOne({ where: { id: req.user.id } });

            if (!user) {
                return helper.error(res, "User not found");
            }

            await user.update({
                name: non_required.name ?? user.name,
                about: non_required.about ?? user.about,
            });

            return helper.success(res, "Profile updated successfully", {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    about: user.about,
                    image: user.image,
                    createdAt: user.createdAt,
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
