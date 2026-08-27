#!/usr/bin/env node
// Copyright (C) 2017-2026 Smart code 203358507

// Measures what the cache/proxy layer (api/_lib/cache) actually buys, without needing any real
// API keys: it stands up a local HTTP "upstream" with a fixed artificial latency, then drives
// the SAME load through it two ways -
//
//   WITHOUT CACHE : every request -> upstream            (Stremio -> addon -> upstream)
//   WITH CACHE    : every request -> getOrFetch(...)     (Stremio -> cache -> [miss] -> upstream)
//
// and prints p50/p95/p99, throughput, and how many upstream calls each approach made. A third
// pass fires N identical cold requests at once to show request-coalescing (single-flight).
//
//   node scripts/cache-benchmark.js
//   UPSTREAM_LATENCY_MS=200 BENCH_REQUESTS=2000 BENCH_CONCURRENCY=100 node scripts/cache-benchmark.js
//
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (e.g. `docker compose up -d`) to run
// the WITH CACHE pass against real Redis instead of the in-memory backend.

const http = require('http');

const LATENCY_MS = Number(process.env.UPSTREAM_LATENCY_MS || 120);
const REQUESTS = Number(process.env.BENCH_REQUESTS || 1000);
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY || 50);
const DISTINCT_KEYS = Number(process.env.BENCH_DISTINCT_KEYS || 20);

const { Cache } = require('../api/_lib/cache');
const { metrics } = require('../api/_lib/cache/metrics');

const percentile = (sortedAsc, p) => {
    if (!sortedAsc.length) return 0;
    return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length))];
};

const summarise = (label, latencies, wallMs, upstreamCalls) => {
    const s = latencies.slice().sort((a, b) => a - b);
    return {
        label,
        n: s.length,
        p50: +percentile(s, 50).toFixed(2),
        p95: +percentile(s, 95).toFixed(2),
        p99: +percentile(s, 99).toFixed(2),
        max: +s[s.length - 1].toFixed(2),
        rps: Math.round((s.length / wallMs) * 1000),
        upstreamCalls,
    };
};

const runLoad = async (task, total, concurrency) => {
    const latencies = [];
    let next = 0;
    const wall0 = performance.now();
    const worker = async () => {
        while (next < total) {
            const i = next++;
            const t0 = performance.now();
            await task(i);
            latencies.push(performance.now() - t0);
        }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { latencies, wallMs: performance.now() - wall0 };
};

const main = async () => {
    let upstreamHits = 0;
    const server = http.createServer((req, res) => {
        upstreamHits += 1;
        setTimeout(() => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ path: req.url, at: Date.now() }));
        }, LATENCY_MS);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const callUpstream = async (i) => {
        const r = await fetch(`${base}/item/${i % DISTINCT_KEYS}`);
        return r.json();
    };

    const cache = new Cache(); // redis if UPSTASH_* env is set, else in-memory

    console.log(`\ncache-benchmark  |  backend=${cache.backendName}  upstreamLatency=${LATENCY_MS}ms  ` +
        `requests=${REQUESTS}  concurrency=${CONCURRENCY}  distinctKeys=${DISTINCT_KEYS}\n`);

    // 1) WITHOUT CACHE ----------------------------------------------------------------------
    upstreamHits = 0;
    const noCache = await runLoad(callUpstream, REQUESTS, CONCURRENCY);
    const withoutRow = summarise('WITHOUT CACHE  (Stremio -> addon -> upstream)', noCache.latencies, noCache.wallMs, upstreamHits);

    // 2) WITH CACHE -----------------------------------------------------------------------
    upstreamHits = 0;
    metrics.reset();
    const cachedTask = (i) => cache.getOrFetch(`bench:item:${i % DISTINCT_KEYS}`, 300, () => callUpstream(i), { swr: false });
    const withCache = await runLoad(cachedTask, REQUESTS, CONCURRENCY);
    const withRow = summarise('WITH CACHE     (Stremio -> cache -> [miss] -> upstream)', withCache.latencies, withCache.wallMs, upstreamHits);

    // 3) COLD STAMPEDE - N identical requests at once, nothing cached ---------------------
    upstreamHits = 0;
    metrics.reset();
    const stampedeCache = new Cache();
    const STAMPEDE = Math.max(CONCURRENCY, 50);
    const t0 = performance.now();
    const stampedeResults = await Promise.all(
        Array.from({ length: STAMPEDE }, () => stampedeCache.getOrFetch('bench:hot', 300, () => callUpstream(0), { swr: false }))
    );
    const stampedeMs = performance.now() - t0;

    server.close();

    const table = [withoutRow, withRow].map((r) => ({
        scenario: r.label,
        p50_ms: r.p50,
        p95_ms: r.p95,
        p99_ms: r.p99,
        'req/s': r['rps'],
        upstream_calls: r.upstreamCalls,
    }));
    console.table(table);

    const reduction = withoutRow.upstreamCalls > 0
        ? (100 * (1 - withRow.upstreamCalls / withoutRow.upstreamCalls)).toFixed(1)
        : '0';
    console.log(`upstream request reduction (WITH vs WITHOUT): ${reduction}%  ` +
        `(${withoutRow.upstreamCalls} -> ${withRow.upstreamCalls})`);
    console.log(`p50 latency: ${withoutRow.p50}ms -> ${withRow.p50}ms   ` +
        `p99: ${withoutRow.p99}ms -> ${withRow.p99}ms`);
    console.log(`\ncold stampede: ${STAMPEDE} identical concurrent requests -> ` +
        `${upstreamHits} upstream call(s) in ${stampedeMs.toFixed(0)}ms  ` +
        `(all ${stampedeResults.length} got the same result: ${stampedeResults.every((x) => x && x.at === stampedeResults[0].at)})\n`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
