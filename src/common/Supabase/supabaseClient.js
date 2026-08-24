// Copyright (C) 2017-2026 Smart code 203358507

// Optional external service, same pattern as SENTRY_DSN in src/index.js: absent by default,
// injected at build time via webpack.EnvironmentPlugin from SUPABASE_URL / SUPABASE_ANON_KEY.
// Nothing in the app should assume Supabase is configured - always gate on isSupabaseConfigured()
// first, the same way Chat's answerGenerator gates on isLlmConfigured() before touching an LLM.

const isSupabaseConfigured = () => {
    return typeof process.env.SUPABASE_URL === 'string' && process.env.SUPABASE_URL.length > 0 &&
        typeof process.env.SUPABASE_ANON_KEY === 'string' && process.env.SUPABASE_ANON_KEY.length > 0;
};

let client = null;
const getSupabaseClient = () => {
    if (!isSupabaseConfigured()) {
        return null;
    }

    if (client === null) {
        // Lazily required so @supabase/supabase-js is never even parsed when not configured.
        const { createClient } = require('@supabase/supabase-js');
        client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    }

    return client;
};

module.exports = { isSupabaseConfigured, getSupabaseClient };
