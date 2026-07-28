const FINCH_API_BASE = 'https://api.tryfinch.com';
const FINCH_API_VERSION = '2020-09-17';

/**
 * Thrown when Finch responds with its "reauthenticate_user" signal -
 * the connection's access token is no longer valid and the user must
 * go through Finch Connect again. Callers should catch this specifically
 * to mark the stored connection as disconnected.
 */
class FinchReauthRequiredError extends Error {
    constructor(message) {
        super(message || 'This payroll connection needs to be reconnected.');
        this.name = 'FinchReauthRequiredError';
        this.reauthRequired = true;
    }
}

function getCredentials() {
    const clientId = process.env.FINCH_CLIENT_ID;
    const clientSecret = process.env.FINCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Finch is not configured (FINCH_CLIENT_ID / FINCH_CLIENT_SECRET)');
    }
    return { clientId, clientSecret };
}

const isSandboxMode = () => process.env.FINCH_SANDBOX !== '0';

/**
 * Logs the active Finch mode at boot so it's impossible to miss whether a
 * deploy is quietly running against Finch's sandbox instead of live payroll
 * providers. In production, a sandbox client secret containing "sandbox" is
 * flagged explicitly, since that's the actual footgun this guards against -
 * FINCH_SANDBOX left at its default while production credentials were never
 * swapped in.
 */
function logFinchMode() {
    const sandbox = isSandboxMode();
    const secret = process.env.FINCH_CLIENT_SECRET || '';
    const looksLikeSandboxSecret = secret.includes('sandbox');
    const label = sandbox ? 'SANDBOX' : 'LIVE';

    console.log(`[Finch] mode: ${label}${sandbox ? '' : ' (production payroll providers)'}`);

    if (process.env.NODE_ENV === 'production' && sandbox) {
        console.warn(
            '[Finch] WARNING: running in production (NODE_ENV=production) with FINCH_SANDBOX not set to "0". ' +
            'Payroll connections will go through Finch\'s sandbox, not real providers. ' +
            'Set FINCH_SANDBOX=0 and swap in live FINCH_CLIENT_ID/FINCH_CLIENT_SECRET before go-live.'
        );
    }
    if (process.env.NODE_ENV === 'production' && !sandbox && looksLikeSandboxSecret) {
        console.warn(
            '[Finch] WARNING: FINCH_SANDBOX=0 but FINCH_CLIENT_SECRET still looks like a sandbox secret. ' +
            'Double-check these are live Finch credentials, not the sandbox pair.'
        );
    }
}

function basicAuthHeader(clientId, clientSecret) {
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/**
 * Shared request wrapper for Bearer-authenticated Finch calls. Detects the
 * "reauthenticate_user" signal and throws FinchReauthRequiredError so
 * callers can handle it uniformly (mark connection disconnected, etc).
 */
async function finchRequest(path, { method = 'GET', accessToken, body } = {}) {
    const res = await fetch(`${FINCH_API_BASE}${path}`, {
        method,
        headers: {
            'Finch-API-Version': FINCH_API_VERSION,
            Authorization: `Bearer ${accessToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && data?.finch_code === 'reauthenticate_user') {
        throw new FinchReauthRequiredError(data.message);
    }
    if (!res.ok) {
        throw new Error(data?.message || `Finch request to ${path} failed (${res.status})`);
    }
    return data;
}

/**
 * Creates a Finch Connect session server-side. The returned session_id is
 * passed to the frontend SDK's open({ sessionId }) call.
 * @param {{ customerId: string, customerName: string, products: string[], sandbox?: boolean }} params
 */
async function createConnectSession({ customerId, customerName, products, sandbox }) {
    const { clientId, clientSecret } = getCredentials();

    const res = await fetch(`${FINCH_API_BASE}/connect/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Finch-API-Version': FINCH_API_VERSION,
            Authorization: basicAuthHeader(clientId, clientSecret),
        },
        body: JSON.stringify({
            customer_id: String(customerId),
            customer_name: customerName,
            products,
            ...(sandbox ? { sandbox: 'finch' } : {}),
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Finch session creation failed (${res.status})`);
    }
    return data; // { session_id, connect_url }
}

/**
 * Exchanges a Finch Connect authorization code for an access token. The
 * response already includes provider_id/connection_id, so no separate
 * introspection call is needed.
 * @param {string} code
 */
async function exchangeCodeForToken(code) {
    const { clientId, clientSecret } = getCredentials();

    const res = await fetch(`${FINCH_API_BASE}/auth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Finch-API-Version': FINCH_API_VERSION,
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Finch token exchange failed (${res.status})`);
    }
    return data; // { access_token, token_type, connection_id, provider_id, products, ... }
}

/**
 * Disconnects the employer/provider pair associated with an access token.
 * @param {string} accessToken
 */
async function disconnect(accessToken) {
    return finchRequest('/disconnect', { method: 'POST', accessToken });
}

/**
 * Lists payroll runs (payments) in a date range.
 * @param {string} accessToken
 * @param {{ startDate: string, endDate: string }} range - YYYY-MM-DD
 */
async function getPayments(accessToken, { startDate, endDate }) {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return finchRequest(`/employer/payment?${params.toString()}`, { accessToken });
}

/**
 * Fetches pay statements (per-individual breakdown) for up to 10 payments
 * at a time, per Finch's batch limit.
 * @param {string} accessToken
 * @param {string[]} paymentIds
 */
async function getPayStatements(accessToken, paymentIds) {
    const batches = [];
    for (let i = 0; i < paymentIds.length; i += 10) {
        batches.push(paymentIds.slice(i, i + 10));
    }

    const allStatements = [];
    for (const batch of batches) {
        const data = await finchRequest('/employer/pay-statement', {
            method: 'POST',
            accessToken,
            body: { requests: batch.map((payment_id) => ({ payment_id })) },
        });
        for (const response of data.responses || []) {
            if (response.code === 200) {
                for (const statement of response.body?.pay_statements || []) {
                    allStatements.push({ ...statement, payment_id: response.payment_id });
                }
            } else {
                console.error(`Finch pay-statement lookup failed for payment ${response.payment_id}:`, response.body);
            }
        }
    }
    return allStatements;
}

/**
 * Fetches basic profile info for a batch of individuals (best-effort,
 * enrichment only - failures here shouldn't abort a sync).
 * @param {string} accessToken
 * @param {string[]} individualIds
 */
async function getIndividuals(accessToken, individualIds) {
    const data = await finchRequest('/employer/individual', {
        method: 'POST',
        accessToken,
        body: { requests: individualIds.map((individual_id) => ({ individual_id })) },
    });
    const byId = {};
    for (const response of data.responses || []) {
        if (response.code === 200) byId[response.individual_id] = response.body;
    }
    return byId;
}

/**
 * Fetches employment details for a batch of individuals.
 * @param {string} accessToken
 * @param {string[]} individualIds
 */
async function getEmployments(accessToken, individualIds) {
    const data = await finchRequest('/employer/employment', {
        method: 'POST',
        accessToken,
        body: { requests: individualIds.map((individual_id) => ({ individual_id })) },
    });
    const byId = {};
    for (const response of data.responses || []) {
        if (response.code === 200) byId[response.individual_id] = response.body;
    }
    return byId;
}

module.exports = {
    FinchReauthRequiredError,
    isSandboxMode,
    logFinchMode,
    createConnectSession,
    exchangeCodeForToken,
    disconnect,
    getPayments,
    getPayStatements,
    getIndividuals,
    getEmployments,
};
