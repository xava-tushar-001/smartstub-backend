const FINCH_API_BASE = 'https://api.tryfinch.com';
const FINCH_API_VERSION = '2020-09-17';

function getCredentials() {
    const clientId = process.env.FINCH_CLIENT_ID;
    const clientSecret = process.env.FINCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Finch is not configured (FINCH_CLIENT_ID / FINCH_CLIENT_SECRET)');
    }
    return { clientId, clientSecret };
}

function basicAuthHeader(clientId, clientSecret) {
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
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
    const res = await fetch(`${FINCH_API_BASE}/disconnect`, {
        method: 'POST',
        headers: {
            'Finch-API-Version': FINCH_API_VERSION,
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Finch disconnect failed (${res.status})`);
    }
    return data; // { status: 'success' }
}

module.exports = { createConnectSession, exchangeCodeForToken, disconnect };
