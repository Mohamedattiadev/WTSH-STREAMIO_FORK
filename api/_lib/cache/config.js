// Copyright (C) 2017-2026 Smart code 203358507

// Single source of truth for every cache tunable. Nothing else in the codebase reads a
// CACHE_* / *_CACHE_TTL env var directly - they all come through here, so a default lives in
// exactly one place (requirement: "Do not hard-code these values throughout the application").

const int = (raw, fallback) => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const bool = (raw, fallback) => {
    if (raw === undefined || raw === null || raw === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(raw));
};

const env = process.env;

// redis is selected automatically the moment Upstash-style REST creds are present, unless
// CACHE_BACKEND forces a value. "memory" is the zero-config local-dev default.
const hasRedisCreds =
    typeof env.UPSTASH_REDIS_REST_URL === 'string' && env.UPSTASH_REDIS_REST_URL.length > 0 &&
    typeof env.UPSTASH_REDIS_REST_TOKEN === 'string' && env.UPSTASH_REDIS_REST_TOKEN.length > 0;

const backend = String(env.CACHE_BACKEND || (hasRedisCreds ? 'redis' : 'memory')).toLowerCase();

const CACHE_CONFIG = {
    // 'memory' | 'redis'
    backend,
    keyPrefix: env.CACHE_KEY_PREFIX || 'wtsh',
    redis: {
        url: env.UPSTASH_REDIS_REST_URL || '',
        token: env.UPSTASH_REDIS_REST_TOKEN || '',
        timeoutMs: int(env.CACHE_REDIS_TIMEOUT_MS, 1500),
    },
    // seconds. Names match the brief; the grouped NOUN_CACHE_TTL form also matches this repo's
    // existing NOUN_NOUN env convention (TMDB_API_KEY, OPENSUBTITLES_API_KEY, ...).
    ttl: {
        // 24h - meta/details rarely change
        metadata: int(env.METADATA_CACHE_TTL, 86400),
        // 6h
        catalog: int(env.CATALOG_CACHE_TTL, 21600),
        // 30m
        search: int(env.SEARCH_CACHE_TTL, 1800),
        // 5m - freshness-sensitive
        stream: int(env.STREAM_CACHE_TTL, 300),
        // 24h
        subtitle: int(env.SUBTITLE_CACHE_TTL, 86400),
        // 7d
        image: int(env.IMAGE_CACHE_TTL, 604800),
        // 30d - tmdbId->imdbId is ~immutable
        idMap: int(env.ID_MAP_CACHE_TTL, 2592000),
    },
    swr: {
        enabled: bool(env.CACHE_SWR_ENABLED, true),
        // Extra window (as a multiple of the soft TTL) a value is physically kept after it goes
        // stale, so it can still be served while an async refresh runs. 1 => keep it one more
        // soft-TTL's worth of time past expiry.
        graceRatio: Number.isFinite(Number.parseFloat(env.CACHE_SWR_GRACE_RATIO))
            ? Math.max(0, Number.parseFloat(env.CACHE_SWR_GRACE_RATIO))
            : 1,
    },
    lock: {
        // Cross-instance single-flight. Only has any effect on the redis backend (an in-memory
        // lock can't coordinate separate serverless instances).
        enabled: bool(env.CACHE_SINGLEFLIGHT_LOCK, true),
        ttlMs: int(env.CACHE_LOCK_TTL_MS, 10000),
        pollMs: int(env.CACHE_LOCK_POLL_MS, 60),
        maxWaitMs: int(env.CACHE_LOCK_MAX_WAIT_MS, 9000),
    },
    // A failed upstream caches a short "don't retry yet" sentinel, so 50 concurrent misses on a
    // broken upstream don't become 50 upstream hits the moment the in-process promise settles.
    negativeTtl: int(env.CACHE_NEGATIVE_TTL, 30),
    // Only honoured when true: lets `?nocache=1` skip the cache (the benchmark harness sets it).
    allowBypass: bool(env.CACHE_ALLOW_BYPASS, false),
    memoryMaxEntries: int(env.CACHE_MEMORY_MAX_ENTRIES, 5000),
    // /api/cache-stats is a 403 until this is set - never open by default.
    statsToken: env.CACHE_STATS_TOKEN || '',
};

module.exports = { CACHE_CONFIG };
