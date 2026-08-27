// Copyright (C) 2017-2026 Smart code 203358507

// Talks to an Upstash-compatible Redis REST endpoint: POST a ["CMD","arg",...] JSON array, get
// back { result } or { error }. That same wire format is served by:
//   * Upstash Redis          - production, provisioned via the Vercel Marketplace
//   * serverless-redis-http   - a thin REST shim in front of a local Valkey/Redis container
//                               (see docker-compose.yml)
// so one dependency-free client (fetch is global in Node 22) covers both prod and local dev.

class RedisUnavailableError extends Error {
    constructor(cause) {
        super(`redis unavailable: ${cause && cause.message ? cause.message : cause}`);
        this.name = 'RedisUnavailableError';
    }
}

class RedisBackend {
    constructor({ url, token, timeoutMs }) {
        this.url = String(url || '').replace(/\/+$/, '');
        this.token = token || '';
        this.timeoutMs = timeoutMs > 0 ? timeoutMs : 1500;
    }

    async _cmd(args) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let res;
        try {
            res = await fetch(this.url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(args.map((a) => (a === undefined || a === null ? '' : String(a)))),
                signal: controller.signal,
            });
        } catch (err) {
            throw new RedisUnavailableError(err);
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) throw new RedisUnavailableError(new Error(`HTTP ${res.status}`));

        let body;
        try {
            body = await res.json();
        } catch (err) {
            throw new RedisUnavailableError(err);
        }
        if (body && body.error) throw new RedisUnavailableError(new Error(body.error));
        return body ? body.result : null;
    }

    async get(key) {
        return this._cmd(['GET', key]);
    }
    async set(key, value, ttlSeconds) {
        return ttlSeconds > 0
            ? this._cmd(['SET', key, value, 'EX', Math.ceil(ttlSeconds)])
            : this._cmd(['SET', key, value]);
    }
    async del(key) {
        return this._cmd(['DEL', key]);
    }
    async exists(key) {
        return (await this._cmd(['EXISTS', key])) === 1;
    }
    async mget(keys) {
        if (!keys.length) return [];
        const r = await this._cmd(['MGET', ...keys]);
        return Array.isArray(r) ? r : keys.map(() => null);
    }
    async pttlMs(key) {
        return this._cmd(['PTTL', key]);
    }

    async acquireLock(key, ttlMs) {
        const r = await this._cmd(['SET', key, '1', 'NX', 'PX', Math.ceil(ttlMs)]);
        return r === 'OK' || r === true;
    }
    async releaseLock(key) {
        return this._cmd(['DEL', key]);
    }

    async incrBy(key, n) {
        return this._cmd(['INCRBY', key, n]);
    }
    async counterSnapshot(prefix) {
        // The stats counter set is small and fixed - GET each by name rather than SCAN, which
        // Upstash rate-limits and which would also sweep real cache entries.
        const names = ['requests', 'hits', 'staleHits', 'misses', 'coalesced', 'upstreamCalls', 'upstreamErrors', 'negativeHits', 'redisErrors'];
        const out = {};
        for (const name of names) {
            const v = await this._cmd(['GET', `${prefix}${name}`]);
            if (v !== null && v !== undefined) out[name] = Number(v);
        }
        return out;
    }

    async size() {
        const n = await this._cmd(['DBSIZE']);
        return Number(n) || 0;
    }
    async flushPrefix() {
        // Deliberately a no-op: app code must never FLUSHDB a shared redis, and per-key SCAN+DEL
        // is not worth the rate-limit cost here. Let TTLs do the cleanup.
    }
}

module.exports = { RedisBackend, RedisUnavailableError };
