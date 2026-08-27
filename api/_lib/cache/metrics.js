// Copyright (C) 2017-2026 Smart code 203358507

// Process-local counters + latency reservoirs. In a serverless deployment each warm instance
// keeps its own copy; /api/cache-stats reports these AND (on the redis backend) redis-aggregated
// totals, so you can see both a single instance's behaviour and the fleet's.

const MAX_SAMPLES = 1000;

const makeState = () => ({
    counters: Object.create(null),
    timers: Object.create(null), // name -> number[] (ring buffer, capped at MAX_SAMPLES)
    startedAt: Date.now(),
});

let state = makeState();

const percentile = (sorted, p) => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
};

const metrics = {
    bump(name, by = 1) {
        state.counters[name] = (state.counters[name] || 0) + by;
    },
    observe(name, ms) {
        const arr = state.timers[name] || (state.timers[name] = []);
        arr.push(ms);
        if (arr.length > MAX_SAMPLES) arr.shift();
    },
    reset() {
        state = makeState();
    },
    snapshot() {
        const counters = { ...state.counters };
        const hits = (counters.hits || 0) + (counters.staleHits || 0);
        const total = hits + (counters.misses || 0);

        const latency = {};
        for (const [name, arr] of Object.entries(state.timers)) {
            const s = [...arr].sort((a, b) => a - b);
            latency[name] = {
                count: s.length,
                p50: Math.round(percentile(s, 50)),
                p95: Math.round(percentile(s, 95)),
                p99: Math.round(percentile(s, 99)),
                max: s.length ? Math.round(s[s.length - 1]) : 0,
            };
        }

        return {
            uptimeMs: Date.now() - state.startedAt,
            counters,
            hitRate: total > 0 ? Number((hits / total).toFixed(4)) : null,
            missRate: total > 0 ? Number(((counters.misses || 0) / total).toFixed(4)) : null,
            latency,
        };
    },
};

module.exports = { metrics, percentile };
