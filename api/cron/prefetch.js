// Copyright (C) 2017-2026 Smart code 203358507

// Optional background prefetch. A Vercel Cron (see vercel.json) calls this on a schedule to warm
// the popular first-party catalog rows into the cache, so the FIRST real visitor after a TTL
// expiry still gets a cache hit instead of paying the cold TMDB round trip.
//
// It only ever re-requests the app's own already-authorized catalog endpoints - the exact same
// calls a normal page load makes - at a low fixed concurrency. It is NOT a scraper and does no
// rate-limit evasion.
//
//   Enabled only when PREFETCH_ENABLED=true.
//   Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations when CRON_SECRET
//   is set in the project. Without CRON_SECRET this endpoint refuses to run.

const addon = require('../addon/[...path].js');

const bool = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
const int = (v, d) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : d;
};

// Drive the addon handler in-process with a throwaway response object; we only care that it
// populated the cache as a side effect.
const warmOne = ({ type, id }) =>
    new Promise((resolve) => {
        const res = {
            _status: 200,
            setHeader() { return this; },
            status(c) { this._status = c; return this; },
            json() { resolve({ type, id, status: this._status }); return this; },
            send() { resolve({ type, id, status: this._status }); return this; },
            end() { resolve({ type, id, status: this._status }); return this; },
        };
        const req = {
            method: 'GET',
            headers: { host: 'prefetch.internal' },
            query: { path: ['catalog', type, id, 'skip=0.json'] },
        };
        Promise.resolve(addon(req, res)).catch((err) => resolve({ type, id, status: 'error', error: String((err && err.message) || err) }));
    });

const runPool = async (items, concurrency, worker) => {
    const results = [];
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            results.push(await worker(item));
        }
    });
    await Promise.all(runners);
    return results;
};

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (!bool(process.env.PREFETCH_ENABLED)) {
        res.status(200).json({ skipped: 'PREFETCH_ENABLED is not true' });
        return;
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) {
        res.status(403).json({ error: 'prefetch disabled: set CRON_SECRET in the Vercel project' });
        return;
    }
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    const targets = Array.isArray(addon.WARM_TARGETS) ? addon.WARM_TARGETS : [];
    const concurrency = int(process.env.PREFETCH_CONCURRENCY, 3);

    const started = Date.now();
    const outcomes = await runPool(targets, concurrency, warmOne);
    const ok = outcomes.filter((o) => o.status === 200).length;

    res.status(200).json({
        ran: true,
        targets: targets.length,
        warmed: ok,
        failed: outcomes.length - ok,
        concurrency,
        ms: Date.now() - started,
        outcomes,
    });
};
