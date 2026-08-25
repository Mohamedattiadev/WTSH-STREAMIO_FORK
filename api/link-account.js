// Copyright (C) 2017-2026 Smart code 203358507

// Vercel serverless function - the only place SUPABASE_SERVICE_ROLE_KEY is ever read. Bridges
// this app's own Stremio login to the separate Supabase account that backs calendar reminders
// and Ask WTSH chat history (see src/common/Supabase/useSupabaseAuth.js), so a user who is
// already signed into Stremio never has to create or enter a second set of credentials.
//
// Input:  { authKey: string } - the Stremio session's own auth.key (src/core/types/models/Ctx.d.ts)
// Output: { tokenHash: string, type: 'magiclink' | 'signup' } - handed to the client's
//         supabase.auth.verifyOtp({ token_hash, type }) to establish a real Supabase session.
//
// The client-supplied authKey is never trusted for identity by itself - this always calls
// Stremio's own account API to resolve it to a real, currently-valid user first, and only ever
// links the Supabase account to the email THAT call returns, never one the client sends.

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { authKey } = req.body ?? {};
    if (typeof authKey !== 'string' || authKey.length === 0) {
        res.status(400).json({ error: 'Expected { authKey: string }' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (typeof supabaseUrl !== 'string' || supabaseUrl.length === 0 || typeof serviceRoleKey !== 'string' || serviceRoleKey.length === 0) {
        res.status(503).json({ error: 'Supabase account linking is not configured on the server' });
        return;
    }

    let email;
    try {
        const stremioResponse = await fetch('https://api.strem.io/api/getUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authKey })
        });
        const stremioData = await stremioResponse.json();
        if (stremioData.error || typeof stremioData.result?.email !== 'string' || stremioData.result.email.length === 0) {
            res.status(401).json({ error: 'Invalid or expired Stremio session' });
            return;
        }
        email = stremioData.result.email;
    } catch (error) {
        console.error('Stremio session verification failed', error);
        res.status(502).json({ error: 'Could not verify Stremio session' });
        return;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        // magiclink requires an existing user; a first-time link falls through to signup, which
        // both creates the user and returns a link in one step. Either way the account ends up
        // email_confirm'd - it was already proven to belong to this email by the Stremio check
        // above, so there is nothing left for a confirmation email to prove.
        let linkResult = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
        let type = 'magiclink';
        if (linkResult.error) {
            linkResult = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email,
                // Discarded immediately - this account is only ever meant to be reached via the
                // magic-link bridge below, never a password the user would need to know.
                password: crypto.randomUUID() + crypto.randomUUID(),
            });
            type = 'signup';
        }

        if (linkResult.error || typeof linkResult.data?.properties?.hashed_token !== 'string') {
            console.error('Supabase link generation failed', linkResult.error);
            res.status(502).json({ error: 'Could not link Supabase account' });
            return;
        }

        res.status(200).json({ tokenHash: linkResult.data.properties.hashed_token, type });
    } catch (error) {
        console.error('link-account failed', error);
        res.status(500).json({ error: 'Internal error' });
    }
};
