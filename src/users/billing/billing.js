const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
const { getClient } = require('../../../helper/stripe');
const { getUsageForUser, isValidPlanTier, getPriceIdForTier, PLAN_TIERS } = require('../../../helper/plan');

module.exports = function () {
    let module = {};

    /**
     * Current plan, subscription status, and this month's upload usage.
     */
    module.GetStatus = async (req, res) => {
        try {
            const { count, limit, effectivePlan } = await getUsageForUser(req.user);

            return helper.success(res, "Billing status", {
                plan: effectivePlan,
                plan_tier: effectivePlan === 'paid' ? req.user.plan_tier : null,
                subscription_status: req.user.subscription_status,
                current_period_end: effectivePlan === 'paid' ? req.user.current_period_end : null,
                usage: {
                    count,
                    limit,
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Creates a Stripe Checkout Session for one of the paid duration tiers
     * (1 Month / 6 Months / 1 Year - see PLAN_TIERS in helper/plan.js) and
     * returns the URL to redirect the user to. Body: { plan: 'monthly' | '6month' | '1year' }
     */
    module.CreateCheckoutSession = async (req, res) => {
        try {
            const tier = req.body.plan;
            if (!isValidPlanTier(tier)) {
                return helper.error(res, `plan must be one of: ${Object.keys(PLAN_TIERS).join(', ')}`);
            }

            const priceId = getPriceIdForTier(tier);
            if (!priceId) {
                return helper.error(res, "This plan isn't configured yet. Please try again later.");
            }

            const stripe = getClient();
            const user = await Users.findByPk(req.user.id);

            let customerId = user.stripe_customer_id;
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.name || undefined,
                    metadata: { user_id: String(user.id) },
                });
                customerId = customer.id;
                await user.update({ stripe_customer_id: customerId });
            }

            await user.update({ plan_tier: tier });

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                customer: customerId,
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: `${frontendUrl}/billing?checkout=success`,
                cancel_url: `${frontendUrl}/billing?checkout=cancel`,
                metadata: { user_id: String(user.id), plan_tier: tier },
            });

            return helper.success(res, "Checkout session created", { url: session.url });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Creates a Stripe Billing Portal session so a paid user can manage or
     * cancel their subscription and view invoices.
     */
    module.CreatePortalSession = async (req, res) => {
        try {
            const user = await Users.findByPk(req.user.id);

            if (!user.stripe_customer_id) {
                return helper.error(res, "You don't have a billing account yet. Upgrade to Pro first.");
            }

            const stripe = getClient();
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
            const session = await stripe.billingPortal.sessions.create({
                customer: user.stripe_customer_id,
                return_url: `${frontendUrl}/billing`,
            });

            return helper.success(res, "Portal session created", { url: session.url });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
