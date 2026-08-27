// Copyright (C) 2017-2026 Smart code 203358507

// The cache abstraction the rest of the app talks to. Callers only ever see get / set / del /
// exists / getOrFetch - never whether the bytes live in redis or a process Map.
//
//   getOrFetch(key, ttlSeconds, fetchFn, opts)  does, in order:
//     1. serve a fresh cached value                                     -> hit
//     2. serve a stale cached value + refresh in the background (SWR)   -> staleHit
//     3. coalesce concurrent misses so fetchFn runs once per key
//          - in-process, always (one warm instance)
//          - cross-instance, via a short redis lock (redis backend only)
//     4. on a fresh miss, run fetchFn once, cache the result
//     5. on upstream failure: serve stale if allowed, else cache a short negative sentinel so a
//        broken upstream is not hammered, then surface an UpstreamError

const { CACHE_CONFIG } = require('./config');
const { MemoryBackend } = require('./memory-backend');
const { RedisBackend, RedisUnavailableError } = require('./redis-backend');
const { metrics } = require('./metrics');

class UpstreamError extends Error {
    constructor(message, { cached = false } = {}) {
        super(message);
        this.name = 'UpstreamError';
        this.cachedFailure = cached; // true => this came from the negative-cache, not a live call
    }
}

const NEG = '__wts_neg__';
const now = () => Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(over || {})) {
        out[k] = isPlainObject(over[k]) ? merge(isPlainObject(base[k]) ? base[k] : {}, over[k]) : over[k];
    }
    return out;
};

// Stored value wrapper: { d: data, t: storedAtMs, s: softTtlSeconds }
const wrap = (data, softTtl) => JSON.stringify({ d: data, t: now(), s: softTtl || 0 });
const unwrap = (raw) => {
    if (typeof raw !== 'string') return null;
    let p;
    try {
        p = JSON.parse(raw);
    } catch (_) {
        return null;
    }
    if (!isPlainObject(p) || !('d' in p)) return null;
    return {
        data: p.d,
        ageSec: (now() - (p.t || 0)) / 1000,
        softTtl: p.s || 0,
        isNegative: p.d === NEG,
    };
};

class Cache {
    constructor(overrides = {}) {
        this.cfg = merge(CACHE_CONFIG, overrides);
        this.mem = new MemoryBackend(this.cfg.memoryMaxEntries);
        if (this.cfg.backend === 'redis') {
            this.redis = new RedisBackend(this.cfg.redis);
            this.primary = 'redis';
        } else {
            this.primary = 'memory';
        }
        this.inflight = new Map(); // key -> Promise (in-process single-flight)
        this._pendingCounts = Object.create(null); // buffered stat increments, flushed as one pipeline
    }

    get backendName() {
        return this.primary;
    }

    // --- metrics: local always; redis totals are buffered and flushed as ONE pipeline ---------
    // (a busy request bumps 3-5 counters; without buffering that was 3-5 separate Redis calls).
    _count(name) {
        metrics.bump(name);
        if (this.primary === 'redis') {
            this._pendingCounts[name] = (this._pendingCounts[name] || 0) + 1;
        }
    }

    _flushCounters() {
        if (this.primary !== 'redis') return;
        const names = Object.keys(this._pendingCounts);
        if (names.length === 0) return;
        const commands = names.map((n) => ['INCRBY', `${this.cfg.keyPrefix}:stats:${n}`, this._pendingCounts[n]]);
        this._pendingCounts = Object.create(null);
        this.redis.pipeline(commands).catch(() => undefined);
    }

    // --- low level: always resolves against a backend, redis failures fall through to memory --
    async _get(key) {
        if (this.primary === 'redis') {
            try {
                return await this.redis.get(key);
            } catch (e) {
                if (e instanceof RedisUnavailableError) {
                    this._count('redisErrors');
                    return this.mem.get(key);
                }
                throw e;
            }
        }
        return this.mem.get(key);
    }
    async _set(key, value, ttl) {
        if (this.primary === 'redis') {
            try {
                return await this.redis.set(key, value, ttl);
            } catch (e) {
                if (e instanceof RedisUnavailableError) {
                    this._count('redisErrors');
                    return this.mem.set(key, value, ttl);
                }
                throw e;
            }
        }
        return this.mem.set(key, value, ttl);
    }
    async _del(key) {
        if (this.primary === 'redis') {
            try {
                await this.redis.del(key);
            } catch (e) {
                if (!(e instanceof RedisUnavailableError)) throw e;
                this._count('redisErrors');
            }
        }
        return this.mem.del(key);
    }
    _backend() {
        return this.primary === 'redis' ? this.redis : this.mem;
    }

    _physicalTtl(softTtl) {
        if (!(softTtl > 0)) return 0;
        if (!this.cfg.swr.enabled) return softTtl;
        return Math.ceil(softTtl * (1 + Math.max(0, this.cfg.swr.graceRatio)));
    }

    // --- simple public API -----------------------------------------------------------------
    async get(key) {
        const t0 = now();
        const raw = await this._get(key);
        metrics.observe('cacheLatencyMs', now() - t0);
        const u = unwrap(raw);
        return u && !u.isNegative ? u.data : null;
    }
    async set(key, value, ttlSeconds) {
        return this._set(key, wrap(value, ttlSeconds), this._physicalTtl(ttlSeconds));
    }
    async del(key) {
        return this._del(key);
    }
    async exists(key) {
        return (await this.get(key)) !== null;
    }

    // Batched read. One MGET (redis) instead of N round trips. Returns an array aligned to
    // `keys`, each entry the unwrapped value or null (miss OR negative-cached).
    async mget(keys) {
        if (!Array.isArray(keys) || keys.length === 0) return [];
        const t0 = now();
        let raws;
        if (this.primary === 'redis') {
            try {
                raws = await this.redis.mget(keys);
            } catch (e) {
                if (!(e instanceof RedisUnavailableError)) throw e;
                this._count('redisErrors');
                raws = await this.mem.mget(keys);
            }
        } else {
            raws = await this.mem.mget(keys);
        }
        metrics.observe('cacheLatencyMs', now() - t0);
        return raws.map((raw) => {
            const u = unwrap(raw);
            return u && !u.isNegative ? u.data : null;
        });
    }

    // --- the core ------------------------------------------------------------------------
    async getOrFetch(key, ttlSeconds, fetchFn, opts = {}) {
        const {
            swr = this.cfg.swr.enabled,
            negativeTtl = this.cfg.negativeTtl,
            lock = this.cfg.lock.enabled,
            allowStaleOnError = true,
            waitUntil = null,
            bypass = false,
        } = opts;

        this._flushCounters(); // ship the previous request's buffered counts in one pipeline
        this._count('requests');

        if (bypass && this.cfg.allowBypass) {
            return this._runFetch(key, ttlSeconds, fetchFn, { negativeTtl, allowStaleOnError });
        }

        const t0 = now();
        const u = unwrap(await this._get(key));
        metrics.observe('cacheLatencyMs', now() - t0);

        if (u) {
            if (u.isNegative) {
                this._count('negativeHits');
                throw new UpstreamError('upstream recently failed (negative-cached)', { cached: true });
            }
            const stale = u.softTtl > 0 && u.ageSec >= u.softTtl;
            if (!stale) {
                this._count('hits');
                return u.data;
            }
            this._count('staleHits');
            if (swr) {
                const refresh = this._revalidate(key, ttlSeconds, fetchFn, { negativeTtl, lock }).catch(() => undefined);
                if (typeof waitUntil === 'function') waitUntil(refresh);
                return u.data;
            }
            // SWR disabled for this call: fall through and refresh synchronously.
        }

        this._count('misses');

        if (this.inflight.has(key)) {
            this._count('coalesced');
            return this.inflight.get(key);
        }
        const p = this._fetchWithLock(key, ttlSeconds, fetchFn, { negativeTtl, lock, allowStaleOnError })
            .finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
        return p;
    }

    async _revalidate(key, ttlSeconds, fetchFn, o) {
        if (this.inflight.has(key)) return this.inflight.get(key);
        const p = this._fetchWithLock(key, ttlSeconds, fetchFn, { ...o, allowStaleOnError: true })
            .finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
        return p;
    }

    async _fetchWithLock(key, ttlSeconds, fetchFn, { negativeTtl, lock, allowStaleOnError }) {
        // Cross-instance coalescing: one instance takes the lock and calls upstream; the others
        // poll the value key. Fail-open everywhere so a redis hiccup can never deadlock a fetch.
        if (lock && this.primary === 'redis') {
            const lockKey = `${key}:lock`;
            let haveLock = false;
            try {
                haveLock = await this.redis.acquireLock(lockKey, this.cfg.lock.ttlMs);
            } catch (e) {
                if (!(e instanceof RedisUnavailableError)) throw e;
                this._count('redisErrors');
                haveLock = true; // redis down -> behave like the memory backend
            }

            if (!haveLock) {
                const got = await this._pollForValue(key);
                if (got !== undefined) {
                    this._count('coalesced');
                    return got;
                }
                // lock holder crashed / timed out without publishing -> fetch anyway
            }

            try {
                return await this._runFetch(key, ttlSeconds, fetchFn, { negativeTtl, allowStaleOnError });
            } finally {
                if (haveLock) {
                    try {
                        await this.redis.releaseLock(lockKey);
                    } catch (_) {
                        /* the PX ttl will clear it */
                    }
                }
            }
        }
        return this._runFetch(key, ttlSeconds, fetchFn, { negativeTtl, allowStaleOnError });
    }

    async _pollForValue(key) {
        const deadline = now() + this.cfg.lock.maxWaitMs;
        while (now() < deadline) {
            await sleep(this.cfg.lock.pollMs);
            const u = unwrap(await this._get(key));
            if (u) {
                if (u.isNegative) {
                    throw new UpstreamError('upstream failed (negative-cached, seen while waiting)', { cached: true });
                }
                return u.data;
            }
        }
        return undefined;
    }

    async _runFetch(key, ttlSeconds, fetchFn, { negativeTtl, allowStaleOnError = true }) {
        const t0 = now();
        try {
            const data = await fetchFn();
            metrics.observe('upstreamLatencyMs', now() - t0);
            this._count('upstreamCalls');
            await this._set(key, wrap(data, ttlSeconds), this._physicalTtl(ttlSeconds));
            return data;
        } catch (err) {
            metrics.observe('upstreamLatencyMs', now() - t0);
            this._count('upstreamCalls');
            this._count('upstreamErrors');

            if (allowStaleOnError) {
                const u = unwrap(await this._get(key));
                if (u && !u.isNegative) return u.data;
            }
            if (negativeTtl > 0) {
                await this._set(key, wrap(NEG, negativeTtl), negativeTtl);
            }
            throw err instanceof UpstreamError ? err : new UpstreamError(err && err.message ? err.message : String(err));
        }
    }

    // --- introspection for /api/cache-stats ------------------------------------------------
    async stats() {
        // flush buffered counts first so the numbers reported are current
        if (this.primary === 'redis') {
            const names = Object.keys(this._pendingCounts);
            if (names.length) {
                const commands = names.map((n) => ['INCRBY', `${this.cfg.keyPrefix}:stats:${n}`, this._pendingCounts[n]]);
                this._pendingCounts = Object.create(null);
                try {
                    await this.redis.pipeline(commands);
                } catch (_) {
                    /* best effort */
                }
            }
        }

        let cacheSize = -1;
        try {
            cacheSize = await this._backend().size();
        } catch (_) {
            cacheSize = -1;
        }
        let aggregateCounters = {};
        try {
            aggregateCounters = await this._backend().counterSnapshot(`${this.cfg.keyPrefix}:stats:`);
        } catch (_) {
            aggregateCounters = {};
        }
        return {
            backend: this.primary,
            keyPrefix: this.cfg.keyPrefix,
            config: {
                ttl: this.cfg.ttl,
                swr: this.cfg.swr,
                lock: this.cfg.lock,
                negativeTtl: this.cfg.negativeTtl,
                allowBypass: this.cfg.allowBypass,
            },
            cacheSize,
            instanceMetrics: metrics.snapshot(),
            aggregateCounters,
        };
    }
}

let singleton = null;
const getCache = () => {
    if (!singleton) singleton = new Cache();
    return singleton;
};
// test hook - drop the process-wide singleton so the next getCache() re-reads env
const _resetCacheSingleton = () => {
    singleton = null;
};

module.exports = { getCache, Cache, UpstreamError, _resetCacheSingleton };
