// Copyright (C) 2017-2026 Smart code 203358507

// Optional durable object store for large, static, rarely-read blobs (currently: fetched-once
// subtitle files). The hot cache is always Redis/memory - this sits beside it, holding bytes
// while Redis holds only a small reference. It is OFF unless OBJECT_STORAGE / TELEGRAM_STORAGE
// is turned on, and the app is fully functional with it off.
//
//   ref  = await store.put(id, buffer, { contentType })   // ref is safe to persist in redis
//   blob = await store.get(ref)                            // -> { buffer, contentType } | null
//          await store.stat(ref)                           // -> metadata | null
//          await store.del(ref)                            // best-effort
//
// See ./telegram.js for the one real adapter and why it is a niche win (Bot API round-trips
// make it a poor fit for hot JSON - Redis alone covers that).

const bool = (raw) => /^(1|true|yes|on)$/i.test(String(raw || ''));

// The default. Every method is a no-op reporting "not stored", so callers can call the store
// unconditionally and just branch on the result.
const nullStore = {
    kind: 'none',
    enabled: false,
    async put() {
        return null;
    },
    async get() {
        return null;
    },
    async stat() {
        return null;
    },
    async del() {
        return false;
    },
};

let singleton = null;

const selectKind = () => {
    // OBJECT_STORAGE=telegram|none, or the simpler TELEGRAM_STORAGE_ENABLED=true toggle.
    const explicit = String(process.env.OBJECT_STORAGE || '').toLowerCase();
    if (explicit === 'telegram') return 'telegram';
    if (explicit === 'none') return 'none';
    return bool(process.env.TELEGRAM_STORAGE_ENABLED) ? 'telegram' : 'none';
};

const getObjectStore = () => {
    if (singleton) return singleton;
    singleton = selectKind() === 'telegram' ? require('./telegram').createTelegramStore() : nullStore;
    return singleton;
};

const _resetObjectStoreSingleton = () => {
    singleton = null;
};

module.exports = { getObjectStore, nullStore, _resetObjectStoreSingleton };
