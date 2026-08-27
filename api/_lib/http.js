// Copyright (C) 2017-2026 Smart code 203358507

// Shared upstream helpers + an allow-list SSRF guard for any code path that fetches a URL that
// a request parameter can influence. The addon's own /osfile proxy has always had its own
// inline guard (OpenSubtitles only); this is the general version for everything else.

// Every host this deployment is legitimately allowed to call server-side. A caller-influenced
// URL that does not resolve to one of these is refused before any socket is opened.
const ALLOWED_UPSTREAM_HOSTS = [
    'api.themoviedb.org',
    'image.tmdb.org',
    'api.opensubtitles.com',
    'dl.opensubtitles.org',
    'opensubtitles.org',
    'opensubtitles.com',
    'archive.org',
    'v3-cinemeta.strem.io',
    'api.strem.io',
    'generativelanguage.googleapis.com',
    'api.telegram.org',
];

class SsrfBlockedError extends Error {
    constructor(host) {
        super(`host not allowed: ${host}`);
        this.name = 'SsrfBlockedError';
        this.host = host;
    }
}

const hostAllowed = (host, allow = ALLOWED_UPSTREAM_HOSTS) => {
    const h = String(host || '').toLowerCase();
    if (!h) return false;
    return allow.some((d) => h === d || h.endsWith(`.${d}`));
};

// Throws SsrfBlockedError unless `raw` is an http(s) URL whose host is on the allow-list.
// Returns the parsed URL on success.
const assertAllowedUrl = (raw, allow = ALLOWED_UPSTREAM_HOSTS) => {
    let u;
    try {
        u = new URL(String(raw));
    } catch (_) {
        throw new SsrfBlockedError(String(raw));
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new SsrfBlockedError(u.protocol);
    if (!hostAllowed(u.hostname, allow)) throw new SsrfBlockedError(u.hostname);
    return u;
};

const fetchWithTimeout = async (url, options = {}, ms = 9000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const fetchJson = async (url, options = {}, ms = 9000) => {
    const res = await fetchWithTimeout(url, options, ms);
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${typeof url === 'string' ? url : 'request'}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
};

module.exports = {
    ALLOWED_UPSTREAM_HOSTS,
    SsrfBlockedError,
    hostAllowed,
    assertAllowedUrl,
    fetchWithTimeout,
    fetchJson,
};
