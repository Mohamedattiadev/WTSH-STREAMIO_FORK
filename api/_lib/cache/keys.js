// Copyright (C) 2017-2026 Smart code 203358507

// Deterministic, normalised cache keys. Two requests that mean the same thing (param order,
// casing, a trailing slash, tt-prefix vs bare digits) MUST map to the same string here, or the
// cache silently fills up with duplicate entries and the hit rate never climbs.

const { CACHE_CONFIG } = require('./config');

const lc = (v) => String(v === undefined || v === null ? '' : v).trim().toLowerCase();

// tt0111161 / TT0111161 / 0111161  ->  tt0111161
// tt0111161:1:2 (series S1E2)      ->  tt0111161:1:2   (season/episode reduced to plain ints)
const normId = (id) => {
    const s = lc(id);
    if (!s) return '';
    const [base, ...rest] = s.split(':');
    const b = base.startsWith('tt') ? base : (/^\d+$/.test(base) ? `tt${base}` : base);
    return [b, ...rest.map((n) => String(Number.parseInt(n, 10) || 0))].join(':');
};

// { skip:'0', genre:'', search:' Foo ' }  ->  "search=foo&skip=0"   (sorted, trimmed, lc,
// empty values dropped). A raw "a=1&b=2" string is accepted and normalised the same way.
const normExtra = (extra) => {
    if (!extra) return '';
    let obj = extra;
    if (typeof extra === 'string') {
        obj = {};
        for (const [k, v] of new URLSearchParams(extra)) obj[k] = v;
    }
    return Object.keys(obj)
        .map((k) => [lc(k), lc(obj[k]).replace(/\s+/g, ' ')])
        .filter(([k, v]) => k.length > 0 && v.length > 0)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
};

const join = (...parts) =>
    `${CACHE_CONFIG.keyPrefix}:${parts.map((p) => (p === '' || p === undefined || p === null ? '-' : String(p))).join(':')}`;

module.exports = {
    lc,
    normId,
    normExtra,
    join,
    // Namespaced builders - the shapes the brief calls out, plus an id-map key and a raw escape
    // hatch for one-off upstream calls.
    metadataKey: (addon, type, id) => join('metadata', lc(addon), lc(type), normId(id)),
    catalogKey: (addon, type, id, extra) => join('catalog', lc(addon), lc(type), lc(id), normExtra(extra)),
    searchKey: (addon, query, page) => join('search', lc(addon), lc(query).replace(/\s+/g, ' '), String(Number.parseInt(page, 10) || 1)),
    streamsKey: (addon, type, id) => join('streams', lc(addon), lc(type), normId(id)),
    subtitlesKey: (addon, id, language, hash) => join('subtitles', lc(addon), normId(id), lc(language) || 'all', lc(hash) || '-'),
    idMapKey: (from, to, id) => join('idmap', lc(from), lc(to), lc(id)),
    rawKey: (...parts) => join('raw', ...parts.map(lc)),
};
