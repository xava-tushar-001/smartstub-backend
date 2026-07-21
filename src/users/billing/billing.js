const helper = require('../../../helper/helper');
const db = require("../../../models");
const Users = db.users;
const { getClient } = require('../../../helper/stripe');
const { getPlanLimit, getMonthlyUploadCount } = require('../../../helper/plan');

module.exports = function () {
    let module = {};

    /**
     * Current plan, subscription status, and this month's upload usage.
     */
    module.GetStatus = async (req, res) => {
        try {
            const usageCount = await getMonthlyUploadCount(req.user.id);

            return helper.success(res, "Billing status", {
                plan: req.user.plan || 'free',
                subscription_status: req.user.subscription_status,
                current_period_end: req.user.current_period_end,
                usage: {
                    count: usageCount,
                    limit: getPlanLimit(req.user.plan || 'free'),
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Creates a Stripe Checkout Session for the $9.99/month Pro plan and
     * returns the URL to redirect the user to.
     */
    module.CreateCheckoutSession = async (req, res) => {
        try {
            if (!process.env.STRIPE_PRICE_ID) {
                return helper.error(res, "Billing is not configured yet. Please try again later.");
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

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                customer: customerId,
                line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
                success_url: `${frontendUrl}/billing?checkout=success`,
                cancel_url: `${frontendUrl}/billing?checkout=cancel`,
                metadata: { user_id: String(user.id) },
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
