const FINCH_API_BASE = 'https://api.tryfinch.com';

function getCredentials() {
    const clientId = process.env.FINCH_CLIENT_ID;
    const clientSecret = process.env.FINCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Finch is not configured (FINCH_CLIENT_ID / FINCH_CLIENT_SECRET)');
    }
    return { clientId, clientSecret };
}

/**
 * Exchanges a Finch Connect authorization code for an access token.
 * @param {string} code
 */
async function exchangeCodeForToken(code) {
    const { clientId, clientSecret } = getCredentials();

    const res = await fetch(`${FINCH_API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    return data; // { access_token, token_type, scope, ... }
}

/**
 * Fetches basic company info to confirm a connection is live and to
 * capture which payroll provider the user connected.
 * @param {string} accessToken
 */
async function getCompanyInfo(accessToken) {
    const res = await fetch(`${FINCH_API_BASE}/employer/company`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Finch company lookup failed (${res.status})`);
    }
    return data;
}

/**
 * Fetches the connected account's introspection info (provider name, etc).
 * @param {string} accessToken
 */
async function introspect(accessToken) {
    const res = await fetch(`${FINCH_API_BASE}/introspect`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Finch introspection failed (${res.status})`);
    }
    return data; // { provider_id, products, connection_id, ... }
}

/**
 * Revokes a Finch access token (used on disconnect).
 * @param {string} accessToken
 */
async function disconnect(accessToken) {
    const { clientId, clientSecret } = getCredentials();
    const res = await fetch(`${FINCH_API_BASE}/employer/disconnect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Finch disconnect failed (${res.status})`);
    }
}

module.exports = { exchangeCodeForToken, getCompanyInfo, introspect, disconnect };
