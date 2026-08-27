// Copyright (C) 2017-2026 Smart code 203358507

// Process-local cache for local dev and as the fail-open fallback when redis is unreachable.
// Values are stored already-serialised (string) to mirror the redis backend's semantics exactly,
// so getOrFetch behaves identically on both. Eviction is plain LRU on a size cap.

class MemoryBackend {
    constructor(maxEntries) {
        this.max = maxEntries > 0 ? maxEntries : 5000;
        this.store = new Map(); // key -> { value: string, expiresAt: number (0 = no expiry) }
        this.counters = new Map();
    }

    _evictIfNeeded() {
        while (this.store.size > this.max) {
            const oldest = this.store.keys().next().value;
            if (oldest === undefined) break;
            this.store.delete(oldest);
        }
    }

    async get(key) {
        const hit = this.store.get(key);
        if (!hit) return null;
        if (hit.expiresAt !== 0 && hit.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }
        // refresh LRU recency
        this.store.delete(key);
        this.store.set(key, hit);
        return hit.value;
    }

    async set(key, value, ttlSeconds) {
        this.store.delete(key);
        this.store.set(key, {
            value: String(value),
            expiresAt: ttlSeconds > 0 ? Date.now() + Math.ceil(ttlSeconds * 1000) : 0,
        });
        this._evictIfNeeded();
        return 'OK';
    }

    async del(key) {
        this.store.delete(key);
        return 1;
    }

    async exists(key) {
        return (await this.get(key)) !== null;
    }

    async mget(keys) {
        const out = [];
        for (const k of keys) out.push(await this.get(k));
        return out;
    }

    async pttlMs(key) {
        const hit = this.store.get(key);
        if (!hit) return -2;
        if (hit.expiresAt === 0) return -1;
        return Math.max(0, hit.expiresAt - Date.now());
    }

    // Best-effort lock so the single-flight code path is exercisable without redis.
    async acquireLock(key, ttlMs) {
        const existing = this.store.get(key);
        if (existing && (existing.expiresAt === 0 || existing.expiresAt > Date.now())) return false;
        await this.set(key, '1', ttlMs / 1000);
        return true;
    }
    async releaseLock(key) {
        this.store.delete(key);
        return 1;
    }

    async incrBy(key, n) {
        const cur = Number(this.counters.get(key) || 0) + Number(n);
        this.counters.set(key, cur);
        return cur;
    }
    async counterSnapshot(prefix) {
        const out = {};
        for (const [k, v] of this.counters) {
            if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
        }
        return out;
    }

    async size() {
        return this.store.size;
    }
    async flushPrefix(prefix) {
        for (const k of [...this.store.keys()]) {
            if (k.startsWith(prefix)) this.store.delete(k);
        }
    }
}

module.exports = { MemoryBackend };
