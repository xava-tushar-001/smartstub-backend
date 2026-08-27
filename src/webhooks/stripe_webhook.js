const db = require('../../models');
const Users = db.users;
const Payment = db.payment;
const { getClient } = require('../../helper/stripe');
const { getTierForPriceId } = require('../../helper/plan');

const ACTIVE_STATUSES = ['active', 'trialing'];

async function findUserByCustomerId(customerId) {
    return Users.findOne({ where: { stripe_customer_id: customerId } });
}

async function applySubscriptionToUser(user, subscription) {
    const isActive = ACTIVE_STATUSES.includes(subscription.status);
    const periodStartSeconds = subscription.current_period_start;
    const periodEndSeconds = subscription.current_period_end;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const tier = getTierForPriceId(priceId);

    await user.update({
        plan: isActive ? 'paid' : 'free',
        // Fall back to whatever tier the user last selected (e.g. /select-plan
        // intent) if the price id doesn't match a known tier - keeps the UI
        // from silently blanking the tier out on an unrelated webhook retry.
        plan_tier: isActive ? (tier || user.plan_tier) : null,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_start: isActive && periodStartSeconds ? new Date(periodStartSeconds * 1000) : null,
        current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
    });
}

async function recordInvoicePayment(invoice, status) {
    if (!invoice.customer) return;
    const user = await findUserByCustomerId(invoice.customer);
    if (!user) return;

    // stripe_invoice_id has a unique constraint - findOrCreate keeps webhook retries idempotent.
    await Payment.findOrCreate({
        where: { stripe_invoice_id: invoice.id },
        defaults: {
            user_id: user.id,
            stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoice.payment_intent || null,
            amount: invoice.amount_paid || invoice.amount_due || 0,
            currency: invoice.currency || 'usd',
            status,
            description: invoice.lines?.data?.[0]?.description || 'SmartStub Pro subscription',
        },
    });
}

/**
 * Express handler for POST /api/v1/webhooks/stripe.
 * Must be mounted with express.raw() so the signature can be verified
 * against the exact bytes Stripe sent.
 */
module.exports = async function stripeWebhook(req, res) {
    let event;
    try {
        const stripe = getClient();
        const signature = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const stripe = getClient();

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode === 'subscription' && session.subscription) {
                    const user = session.metadata?.user_id
                        ? await Users.findByPk(session.metadata.user_id)
                        : await findUserByCustomerId(session.customer);

                    if (user) {
                        const subscription = await stripe.subscriptions.retrieve(session.subscription);
                        if (!user.stripe_customer_id) {
                            await user.update({ stripe_customer_id: session.customer });
                        }
                        await applySubscriptionToUser(user, subscription);
                    }
                }
                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.created': {
                const subscription = event.data.object;
                const user = await findUserByCustomerId(subscription.customer);
                if (user) {
                    await applySubscriptionToUser(user, subscription);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const user = await findUserByCustomerId(subscription.customer);
                if (user) {
                    await user.update({
                        plan: 'free',
                        plan_tier: null,
                        subscription_status: 'canceled',
                        current_period_start: null,
                        current_period_end: null,
                    });
                }
                break;
            }

            case 'invoice.paid': {
                await recordInvoicePayment(event.data.object, 'paid');
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                await recordInvoicePayment(invoice, 'failed');
                const user = await findUserByCustomerId(invoice.customer);
                if (user) {
                    await user.update({ subscription_status: 'past_due' });
                }
                break;
            }

            default:
                break;
        }

        return res.json({ received: true });
    } catch (err) {
        console.error('Stripe webhook handling failed:', err);
        return res.status(500).json({ received: false });
    }
};
