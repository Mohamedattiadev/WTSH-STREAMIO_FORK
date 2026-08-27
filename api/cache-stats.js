// Copyright (C) 2017-2026 Smart code 203358507

// Admin / observability endpoint. Reports cache hit & miss rates, cache-vs-upstream latency
// percentiles (p50/p95/p99), request-coalescing counts, negative-cache hits and cache size, so
// you can see exactly where request time is going.
//
//   GET /api/cache-stats?token=<CACHE_STATS_TOKEN>     (or header: x-cache-stats-token)
//   GET /api/cache-stats?token=...&reset=1             clears this instance's counters
//
// It is a 403 until CACHE_STATS_TOKEN is set - never open by default. No secrets are returned;
// only aggregate numbers and the (non-secret) TTL configuration.

const { getCache } = require('./_lib/cache');
const { metrics } = require('./_lib/cache/metrics');
const { CACHE_CONFIG } = require('./_lib/cache/config');

// length-independent constant-time-ish string compare
const safeEqual = (a, b) => {
    const sa = String(a || '');
    const sb = String(b || '');
    let diff = sa.length ^ sb.length;
    for (let i = 0; i < sa.length; i++) {
        diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i % sb.length || 0);
    }
    return diff === 0 && sa.length === sb.length && sa.length > 0;
};

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const expected = CACHE_CONFIG.statsToken;
    if (!expected) {
        res.status(403).json({ error: 'cache-stats is disabled: set CACHE_STATS_TOKEN to enable it' });
        return;
    }

    const provided = req.headers['x-cache-stats-token'] || (req.query && req.query.token) || '';
    if (!safeEqual(provided, expected)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    if (req.query && (req.query.reset === '1' || req.query.reset === 'true')) {
        metrics.reset();
        res.status(200).json({ ok: true, reset: true });
        return;
    }

    try {
        res.status(200).json(await getCache().stats());
    } catch (err) {
        res.status(500).json({ error: 'failed to gather stats', detail: String((err && err.message) || err) });
    }
};
