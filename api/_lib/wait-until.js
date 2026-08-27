// Copyright (C) 2017-2026 Smart code 203358507

// Hands a background promise to the platform's keep-alive so a stale-while-revalidate refresh
// always finishes, even if the serverless instance would otherwise freeze the moment the
// response is flushed. Uses @vercel/functions' `waitUntil` when it is installed; otherwise falls
// back to a detached promise (harmless - the next request completes the refresh instead).
// @vercel/functions is an OPTIONAL dependency: `pnpm add @vercel/functions` to light this up.

let platformWaitUntil = null;
try {
    ({ waitUntil: platformWaitUntil } = require('@vercel/functions'));
} catch (_) {
    platformWaitUntil = null;
}

const waitUntil = (promise) => {
    if (typeof platformWaitUntil === 'function') {
        try {
            platformWaitUntil(promise);
            return;
        } catch (_) {
            // fall through to the detached fallback
        }
    }
    Promise.resolve(promise).catch(() => undefined);
};

const hasPlatformWaitUntil = () => typeof platformWaitUntil === 'function';

module.exports = { waitUntil, hasPlatformWaitUntil };
