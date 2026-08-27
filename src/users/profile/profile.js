const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
const { isValidPlanTier } = require('../../../helper/plan');

module.exports = function () {
    let module = {};

    module.GetProfile = async (req, res) => {
        try {
            const user = await Users.findOne({
                where: { id: req.user.id },
                attributes: ["id", "name", "email", "about", "image", "createdAt", "plan", "plan_tier", "plan_selected", "subscription_status", "current_period_end"],
            });

            if (!user) {
                return helper.error(res, "User not found");
            }

            return helper.success(res, "Profile fetched successfully", { user });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Records the user's choice on the post-verification Plan Selection
     * screen. Body: { plan: 'free' | 'monthly' | '6month' | '1year' }
     * Picking 'free' takes effect immediately (it's already the default).
     * Picking a paid tier only records the intent and marks the screen as
     * done - the frontend still has to complete Stripe checkout separately
     * (passing the same tier id) to actually become paid.
     */
    module.SelectPlan = async (req, res) => {
        try {
            const plan = req.body.plan;
            if (plan !== 'free' && !isValidPlanTier(plan)) {
                return helper.error(res, "plan must be 'free', 'monthly', '6month', or '1year'");
            }

            const user = await Users.findOne({ where: { id: req.user.id } });
            if (!user) {
                return helper.error(res, "User not found");
            }

            await user.update({
                plan_selected: true,
                ...(plan === 'free' ? { plan: 'free', plan_tier: null } : { plan_tier: plan }),
            });

            return helper.success(res, "Plan selection saved", {
                plan: user.plan,
                plan_tier: user.plan_tier,
                plan_selected: true,
            });
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
