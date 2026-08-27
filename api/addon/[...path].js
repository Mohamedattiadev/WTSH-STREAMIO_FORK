// Copyright (C) 2017-2026 Smart code 203358507

// First-party Stremio addon, served from this same Vercel deployment - no separate host, no
// account to create, no token in any URL. It exposes exactly two resources, both legitimate by
// construction (it can never return a stream, which is why useAutoInstallEssentialAddons is
// allowed to install it silently):
//
//   * subtitles - multi-language (Arabic / English / Turkish surfaced first, then every other
//                 language). Search hits api.opensubtitles.com's public /subtitles endpoint,
//                 which needs no API key; each hit is downloaded keyless from
//                 dl.opensubtitles.org/.../subencoding-utf8/sub/<legacy id> (a UTF-8 ZIP), and
//                 our /api/addon/osfile proxy unzips it and hands the player a clean .srt.
//                 rest.opensubtitles.org (the old keyless endpoint Stremio's own addon used) is
//                 dead as of 2026 - it now 302s to a broken host. When the streaming server
//                 computed an OpenSubtitles movie hash we pass it through as `moviehash`, so the
//                 frame-accurate matches (`moviehash_match`) sort to the top.
//   * catalog  - TMDB browse rows (Trending / Popular / Arabic / Turkish / Anime, movie and
//                series), emitting real IMDb ids so every OTHER installed addon can still
//                resolve streams for these titles and Cinemeta still owns the detail page.
//                Reuses the same TMDB_API_KEY api/reviews.js + api/hero-enrichment.js read; if
//                that env var is absent the catalogs are simply omitted from the manifest.
//
// Routes (the /api prefix is optional - see the alias in vercel.json):
//   GET /api/addon/manifest.json
//   GET /api/addon/subtitles/{type}/{id}/{extra}.json      id = tt1234567  or  tt1234567:1:2
//   GET /api/addon/catalog/{type}/{catalogId}/{extra}.json extra = skip=NN&search=...&genre=...
//   GET /api/addon/osfile/{base64url}.srt

const zlib = require('zlib');

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

const OS_API_BASE = 'https://api.opensubtitles.com/api/v1';
// dl.opensubtitles.org serves the sub file with no auth and no per-key download quota (only a
// soft per-IP rate limit, which our month-long CDN cache on the proxy response makes a
// non-issue - each distinct subtitle is fetched from OpenSubtitles at most once a month across
// every user of the deployment). The `subencoding-utf8` segment makes their side transcode
// legacy CP1256 / CP1254 uploads to UTF-8 before zipping; bytesToUtf8() still guards against a
// mis-declared encoding.
const OS_DL_BASE = 'https://dl.opensubtitles.org/en/download/subencoding-utf8/sub/';
// opensubtitles.com asks clients to send a "AppName vX.Y.Z" User-Agent; override via env if it
// ever needs to be a registered one.
const OS_USER_AGENT = process.env.OPENSUBTITLES_UA || 'WTSH-Stremio-Addon v1.0.0';
// OPTIONAL. Server-side only (never goes near the client bundle or any URL). Without it, search
// falls back to unauthenticated requests, which opensubtitles.com rate-limits hard from a busy
// egress IP. A free key from https://www.opensubtitles.com/en/consumers makes search reliable;
// downloads stay keyless via OS_DL_BASE either way.
const OS_API_KEY = process.env.OPENSUBTITLES_API_KEY || '';

const PAGE_SIZE = 20;
const MAX_SUBS_PER_LANG = 15;
const MAX_SUBS_TOTAL = 240;

// Languages we always float to the top of the subtitle list, in this order.
const PRIORITY_LANGS = ['ara', 'eng', 'tur'];

// OpenSubtitles reports encodings in a handful of spellings; normalise to what TextDecoder
// (WHATWG label set, full-ICU Node) actually accepts.
const ENCODING_ALIASES = {
    'CP1256': 'windows-1256', 'WINDOWS-1256': 'windows-1256',
    'CP1254': 'windows-1254', 'WINDOWS-1254': 'windows-1254',
    'CP1250': 'windows-1250', 'CP1251': 'windows-1251', 'CP1252': 'windows-1252',
    'ISO-8859-1': 'iso-8859-1', 'ISO-8859-9': 'iso-8859-9',
    'LATIN1': 'iso-8859-1', 'LATIN5': 'iso-8859-9',
    'UTF8': 'utf-8', 'UTF-8': 'utf-8'
};

// 2-letter (or region-tagged, e.g. "pt-BR") ISO 639-1 -> ISO 639-2/B, which is what Stremio
// uses to label and group subtitle tracks.
const ISO1_TO_ISO3 = {
    ar: 'ara', en: 'eng', tr: 'tur', fr: 'fre', de: 'ger', es: 'spa', it: 'ita', pt: 'por',
    ru: 'rus', nl: 'dut', pl: 'pol', sv: 'swe', da: 'dan', fi: 'fin', no: 'nor', cs: 'cze',
    el: 'ell', he: 'heb', hi: 'hin', id: 'ind', ja: 'jpn', ko: 'kor', zh: 'chi', ro: 'rum',
    hu: 'hun', uk: 'ukr', fa: 'per', th: 'tha', vi: 'vie', bg: 'bul', hr: 'hrv', sr: 'srp',
    sk: 'slo', sl: 'slv', et: 'est', lv: 'lav', lt: 'lit', ms: 'may', bn: 'ben', ta: 'tam',
    te: 'tel', ml: 'mal', ur: 'urd', is: 'ice', ka: 'geo', hy: 'arm', az: 'aze', mk: 'mac',
    sq: 'alb', eu: 'baq', gl: 'glg', ca: 'cat'
};

const langToIso3 = (raw) => {
    const two = String(raw || '').toLowerCase().split('-')[0];
    if (two.length === 3) return two;
    return ISO1_TO_ISO3[two] || two || 'und';
};

// -- TMDB catalog definitions ------------------------------------------------------------------
// Keyed by the exact catalog id that appears in the manifest (each id already encodes its type).
const CATALOGS = {
    'wtsh.trending.movie': { type: 'movie', tmdbType: 'movie', name: 'Trending Movies', path: 'trending/movie/week', lang: 'en-US' },
    'wtsh.trending.series': { type: 'series', tmdbType: 'tv', name: 'Trending Series', path: 'trending/tv/week', lang: 'en-US' },
    'wtsh.popular.movie': { type: 'movie', tmdbType: 'movie', name: 'Popular Movies', path: 'movie/popular', lang: 'en-US' },
    'wtsh.popular.series': { type: 'series', tmdbType: 'tv', name: 'Popular Series', path: 'tv/popular', lang: 'en-US' },
    'wtsh.arabic.movie': { type: 'movie', tmdbType: 'movie', name: 'Arabic Movies', path: 'discover/movie', lang: 'ar', discover: { with_original_language: 'ar', sort_by: 'popularity.desc' } },
    'wtsh.arabic.series': { type: 'series', tmdbType: 'tv', name: 'Arabic Series', path: 'discover/tv', lang: 'ar', discover: { with_original_language: 'ar', sort_by: 'popularity.desc' } },
    'wtsh.turkish.movie': { type: 'movie', tmdbType: 'movie', name: 'Turkish Movies', path: 'discover/movie', lang: 'tr', discover: { with_original_language: 'tr', sort_by: 'popularity.desc' } },
    'wtsh.turkish.series': { type: 'series', tmdbType: 'tv', name: 'Turkish Series', path: 'discover/tv', lang: 'tr', discover: { with_original_language: 'tr', sort_by: 'popularity.desc' } },
    'wtsh.anime.series': { type: 'series', tmdbType: 'tv', name: 'Anime', path: 'discover/tv', lang: 'en-US', discover: { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' } },
    'wtsh.anime.movie': { type: 'movie', tmdbType: 'movie', name: 'Anime Movies', path: 'discover/movie', lang: 'en-US', discover: { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' } }
};

// -- small helpers ---------------------------------------------------------------------------

const hasTmdb = () => typeof process.env.TMDB_API_KEY === 'string' && process.env.TMDB_API_KEY.length > 0;

const cors = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
};

const sendJson = (res, status, body, cacheSeconds) => {
    cors(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (cacheSeconds) {
        res.setHeader('Cache-Control', `public, max-age=${Math.min(cacheSeconds, 3600)}, s-maxage=${cacheSeconds}, stale-while-revalidate=604800`);
    }
    res.status(status).send(JSON.stringify(body));
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

// Parse the trailing `key=value&key2=value2` segment Stremio appends to catalog/subtitle URLs.
const parseExtra = (raw, query) => {
    const out = {};
    if (typeof raw === 'string' && raw.includes('=')) {
        for (const [k, v] of new URLSearchParams(raw)) {
            out[k] = v;
        }
    }
    for (const [k, v] of Object.entries(query || {})) {
        if (typeof v === 'string' && k !== 'path') {
            out[k] = v;
        }
    }
    return out;
};

// -- manifest -------------------------------------------------------------------------------

const buildManifest = () => {
    const manifest = {
        id: 'org.wtsh.addon',
        version: '1.0.0',
        name: 'WTSH — Subtitles, Catalogs & Public-Domain',
        description:
            'Multi-language subtitles (Arabic, English, Turkish first, then every other language) '
            + 'from OpenSubtitles, synced to the video by hash; TMDB browse rows for movies, series '
            + 'and anime; and public-domain film streams from the Internet Archive. No torrent or '
            + 'scraper sources.',
        logo: 'https://www.stremio.com/website/stremio-logo-small.png',
        resources: ['subtitles', 'stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: [],
        behaviorHints: { configurable: false, configurationRequired: false, p2p: false }
    };

    if (hasTmdb()) {
        manifest.resources = ['subtitles', 'stream', 'catalog'];
        manifest.catalogs = Object.entries(CATALOGS).map(([id, def]) => ({
            type: def.type,
            id,
            name: def.name,
            extra: [
                { name: 'skip', isRequired: false },
                { name: 'search', isRequired: false },
                { name: 'genre', isRequired: false }
            ],
            extraSupported: ['skip', 'search', 'genre']
        }));
    }

    return manifest;
};

// -- subtitles ----------------------------------------------------------------------------

const osSearch = async (params) => {
    // opensubtitles.com canonicalises its query string: keys lowercased and sorted, list
    // values sorted. Send it any other way and it 301s / misses cache instead of answering.
    const usp = new URLSearchParams();
    for (const key of Object.keys(params).sort()) {
        const val = String(params[key]);
        usp.set(key, val.includes(',') ? val.split(',').map((s) => s.trim()).sort().join(',') : val);
    }
    const url = `${OS_API_BASE}/subtitles?${usp.toString()}`;
    const headers = { 'User-Agent': OS_USER_AGENT, 'Accept': 'application/json' };
    if (OS_API_KEY) headers['Api-Key'] = OS_API_KEY;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const resp = await fetchWithTimeout(url, { headers }, 9000);
            if (resp.status === 429 || resp.status >= 500) {
                await new Promise((r) => setTimeout(r, 400));
                continue;
            }
            if (!resp.ok) return [];
            const data = await resp.json();
            return Array.isArray(data.data) ? data.data : [];
        } catch (_) {
            // timeout / network - retry once, then give up quietly
        }
    }
    return [];
};

const handleSubtitles = async (res, type, id, extra, base) => {
    if (!id || !/^tt\d+/.test(id)) {
        return sendJson(res, 200, { subtitles: [] }, 60);
    }

    const [imdb, season, episode] = id.split(':');
    const digits = imdb.replace(/^tt/, '').replace(/[^0-9]/g, '');
    if (!digits) return sendJson(res, 200, { subtitles: [] }, 60);

    const isEpisode = season !== undefined && episode !== undefined;
    const hash = (extra.videoHash || extra.moviehash || '').toLowerCase().trim();
    const validHash = /^[a-f0-9]{16}$/.test(hash) ? hash : null;

    // Base id params: for an episode Stremio only ever gives us the *series* imdb id + s/e, so
    // ask by parent_imdb_id + season/episode number.
    const idParams = isEpisode
        ? { parent_imdb_id: digits, season_number: String(parseInt(season, 10)), episode_number: String(parseInt(episode, 10)) }
        : { imdb_id: digits };

    const searches = [
        // broad: every language, most-downloaded first
        osSearch({ ...idParams, order_by: 'download_count', order_direction: 'desc' }),
        // guaranteed Arabic + Turkish coverage even when page 1 of "all" is English-heavy
        osSearch({ ...idParams, languages: 'ar,tr', order_by: 'download_count', order_direction: 'desc' })
    ];
    if (validHash) {
        searches.push(osSearch({ ...idParams, moviehash: validHash }));
    }

    const lists = await Promise.all(searches);
    const merged = [].concat(...lists);

    const seen = new Set();
    const perLang = new Map();
    const rows = [];

    for (const entry of merged) {
        const a = entry && entry.attributes;
        if (!a) continue;
        const legacyId = a.legacy_subtitle_id || (entry.id && /^\d+$/.test(String(entry.id)) ? entry.id : null);
        if (!legacyId) continue;
        if (a.foreign_parts_only) continue;

        const lang = langToIso3(a.language);
        const dedupeKey = String(legacyId);
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const count = perLang.get(lang) || 0;
        if (count >= MAX_SUBS_PER_LANG) continue;
        perLang.set(lang, count + 1);

        rows.push({
            lang,
            legacyId,
            hashMatch: Boolean(a.moviehash_match),
            trusted: Boolean(a.from_trusted),
            robotic: Boolean(a.ai_translated) || Boolean(a.machine_translated),
            downloads: Number(a.download_count) || Number(a.new_download_count) || 0,
            release: (a.release || '').slice(0, 60)
        });
    }

    rows.sort((x, y) => {
        const px = PRIORITY_LANGS.indexOf(x.lang);
        const py = PRIORITY_LANGS.indexOf(y.lang);
        const rx = px === -1 ? PRIORITY_LANGS.length : px;
        const ry = py === -1 ? PRIORITY_LANGS.length : py;
        if (rx !== ry) return rx - ry;
        if (x.hashMatch !== y.hashMatch) return x.hashMatch ? -1 : 1;
        if (x.robotic !== y.robotic) return x.robotic ? 1 : -1;
        if (x.trusted !== y.trusted) return x.trusted ? -1 : 1;
        return y.downloads - x.downloads;
    });

    const subtitles = rows.slice(0, MAX_SUBS_TOTAL).map((r, i) => {
        const dl = `${OS_DL_BASE}${r.legacyId}`;
        return {
            id: `wtsh-${r.legacyId}-${i}`,
            lang: r.lang,
            url: `${base}/api/addon/osfile/${Buffer.from(dl).toString('base64url')}.srt`
        };
    });

    // A given hash/imdb id's subtitle set is stable for hours - let the CDN serve repeat
    // requests so the second play of anything comes back instantly.
    return sendJson(res, 200, { subtitles }, 21600);
};

// -- subtitle file proxy: unzip + guarantee UTF-8 ------------------------------------------

// Minimal ZIP reader over the central directory (dl.opensubtitles.org returns a ZIP, usually
// one .srt, sometimes a .nfo alongside). No dependency - stdlib zlib does the inflate.
const SUB_EXT = /\.(srt|ass|ssa|vtt|sub)$/i;

const extractSubtitleFromZip = (buf) => {
    // End of Central Directory record: scan backwards for the 'PK\x05\x06' signature.
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) return null;

    const entryCount = buf.readUInt16LE(eocd + 10);
    let ptr = buf.readUInt32LE(eocd + 16); // central directory offset

    const entries = [];
    for (let n = 0; n < entryCount && ptr + 46 <= buf.length; n++) {
        if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
        const method = buf.readUInt16LE(ptr + 10);
        const compSize = buf.readUInt32LE(ptr + 20);
        const uncompSize = buf.readUInt32LE(ptr + 24);
        const nameLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const localOffset = buf.readUInt32LE(ptr + 42);
        const name = buf.toString('utf-8', ptr + 46, ptr + 46 + nameLen);
        entries.push({ name, method, compSize, uncompSize, localOffset });
        ptr += 46 + nameLen + extraLen + commentLen;
    }
    if (!entries.length) return null;

    entries.sort((a, b) => {
        const as = SUB_EXT.test(a.name) ? 0 : 1;
        const bs = SUB_EXT.test(b.name) ? 0 : 1;
        if (as !== bs) return as - bs;
        return b.uncompSize - a.uncompSize;
    });
    const pick = entries[0];
    if (!SUB_EXT.test(pick.name)) return null;

    // Local file header: recompute the data offset from *its* name/extra lengths (they can
    // differ from the central directory's).
    if (buf.readUInt32LE(pick.localOffset) !== 0x04034b50) return null;
    const lNameLen = buf.readUInt16LE(pick.localOffset + 26);
    const lExtraLen = buf.readUInt16LE(pick.localOffset + 28);
    const dataStart = pick.localOffset + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + pick.compSize);

    try {
        if (pick.method === 0) return Buffer.from(comp);
        if (pick.method === 8) return zlib.inflateRawSync(comp);
    } catch (_) {
        return null;
    }
    return null;
};

const bytesToUtf8 = (bytes, encHint) => {
    const tryDecode = (label) => {
        try {
            const text = new TextDecoder(label, { fatal: false }).decode(bytes);
            return { text, bad: (text.match(/�/g) || []).length };
        } catch (_) {
            return null;
        }
    };

    const normalized = ENCODING_ALIASES[(encHint || '').toUpperCase()] || String(encHint || '').toLowerCase();
    const candidates = [];
    if (normalized) candidates.push(normalized);
    candidates.push('utf-8', 'windows-1256', 'windows-1254', 'iso-8859-1');

    let best = null;
    for (const label of candidates) {
        const attempt = tryDecode(label);
        if (!attempt) continue;
        if (attempt.bad === 0) { best = attempt; break; }
        if (!best || attempt.bad < best.bad) best = attempt;
    }
    const text = best ? best.text : Buffer.from(bytes).toString('utf-8');
    return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
};

const handleOsFile = async (res, b64) => {
    let target;
    try {
        target = Buffer.from(b64, 'base64url').toString('utf-8');
    } catch (_) {
        cors(res);
        return res.status(400).send('bad file ref');
    }

    let host;
    try {
        host = new URL(target).hostname.toLowerCase();
    } catch (_) {
        cors(res);
        return res.status(400).send('bad url');
    }
    // SSRF guard: only ever fetch from OpenSubtitles itself.
    const ok = ['opensubtitles.org', 'opensubtitles.com'].some((d) => host === d || host.endsWith(`.${d}`));
    if (!ok) {
        cors(res);
        return res.status(403).send('forbidden host');
    }

    try {
        const resp = await fetchWithTimeout(target, {
            headers: { 'User-Agent': OS_USER_AGENT, 'Accept': '*/*' },
            redirect: 'follow'
        }, 12000);
        if (!resp.ok) {
            cors(res);
            return res.status(502).send('upstream error');
        }
        const raw = Buffer.from(await resp.arrayBuffer());

        let bytes = raw;
        if (raw.length > 3 && raw[0] === 0x50 && raw[1] === 0x4b) {
            // 'PK' - a ZIP (this is what dl.opensubtitles.org returns)
            const inner = extractSubtitleFromZip(raw);
            if (!inner) {
                cors(res);
                return res.status(502).send('no subtitle in archive');
            }
            bytes = inner;
        } else if (raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
            // gzip - just in case a different link shape ever slips through
            try { bytes = zlib.gunzipSync(raw); } catch (_) { bytes = raw; }
        }

        const text = bytesToUtf8(bytes, '');
        cors(res);
        res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
        // The file behind a legacy id never changes - cache it hard at the edge.
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable');
        return res.status(200).send(text);
    } catch (_) {
        cors(res);
        return res.status(504).send('timeout');
    }
};

// -- streams: Internet Archive public-domain films -----------------------------------------
//
// Deliberately the ONLY stream source here. The Internet Archive hosts public-domain and
// openly-licensed media; we match a title by name + year and hand back its direct download
// URLs. No torrent indexers, no scraper sites - if you want those, install a third-party addon
// (Torrentio/Comet/...) yourself; this addon will never carry one.

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io/meta';
const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_META = 'https://archive.org/metadata/';
const IA_DL = 'https://archive.org/download/';

const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|ogv|mov)$/i;
const WEB_READY_EXT = /\.(mp4|m4v|webm)$/i;

// IA's own curated public-domain / freely-licensed collections. The search is constrained to
// these so it can't surface a `opensource_movies` / `community` upload (unmoderated - that's
// where pirate rips of in-copyright films and TV end up).
const IA_PD_COLLECTIONS = ['feature_films', 'silent_films', 'film_noir', 'classic_tv', 'prelinger', 'animationandcartoons'];
const IA_BAD_COLLECTIONS = /^(opensource_movies|community|movie_trailers|movie_trailers_unsorted|test_collection)$/;
// Scene / release-group markers - a genuinely public-domain IA upload is a plain transfer, not
// a modern P2P encode. Belt-and-braces on top of the collection filter (some slip into
// feature_films). Plain resolution tags like `_1080p` are NOT a reject signal - legit IA
// transfers use them too.
const SCENE_MARKER = /(yify|yts|rarbg|galaxyrg|\bvxt\b|-vxt|web[ ._-]?dl|web[ ._-]?rip|hd[ ._-]?rip|bd[ ._-]?rip|br[ ._-]?rip|blu[ ._-]?ray|remux|x265|x264|hevc|h[ .]?265|h[ .]?264|\[sev\]|d0ct0r|dts[ ._-]?hd|\bddp?5\b|myme|meflix|eztv|\bfgt\b|\bevo\b|\btgx\b)/i;

const normTitle = (s) => String(s || '')
    .toLowerCase()
    .replace(/^\s*the\s+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const humanSize = (bytes) => {
    const n = Number(bytes);
    if (!n) return null;
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
    return `${Math.round(n / 1024 ** 2)} MB`;
};

const cinemetaMeta = async (type, ttid) => {
    try {
        const resp = await fetchWithTimeout(`${CINEMETA_BASE}/${type}/${ttid}.json`, {}, 7000);
        if (!resp.ok) return null;
        const data = await resp.json();
        const m = data && data.meta;
        if (!m) return null;
        const year = parseInt(String(m.year || m.releaseInfo || '').slice(0, 4), 10) || null;
        return { name: m.name || '', year };
    } catch (_) {
        return null;
    }
};

const iaSearch = async (name, year) => {
    const safe = name.replace(/"/g, '');
    // Three gates, all required: (1) a title phrase match, (2) sits in one of IA's curated
    // public-domain collections, (3) the item carries a public-domain license tag. None of
    // these is individually authoritative (uploaders self-assign collection + license), but
    // together they block everything obviously in-copyright. Rare mislabeled uploads can still
    // get through - same limitation every IA-backed "public domain" addon has.
    let q = `title:("${safe}") AND mediatype:(movies)`
        + ` AND collection:(${IA_PD_COLLECTIONS.join(' OR ')})`
        + ' AND licenseurl:(*publicdomain*)';
    if (year) q += ` AND year:[${year - 1} TO ${year + 1}]`;
    const usp = new URLSearchParams({ q, rows: '15', output: 'json', sort: 'downloads desc' });
    usp.append('fl[]', 'identifier');
    usp.append('fl[]', 'title');
    usp.append('fl[]', 'year');
    usp.append('fl[]', 'collection');
    try {
        const resp = await fetchWithTimeout(`${IA_SEARCH}?${usp.toString()}`, {}, 9000);
        if (!resp.ok) return [];
        const data = await resp.json();
        const docs = (data && data.response && data.response.docs) || [];
        const target = normTitle(name);
        return docs.filter((d) => {
            const cols = [].concat(d.collection || []);
            // must sit in at least one whitelisted collection and none of the unmoderated ones
            if (!cols.some((c) => IA_PD_COLLECTIONS.includes(c))) return false;
            if (cols.some((c) => IA_BAD_COLLECTIONS.test(c))) return false;
            const t = normTitle(d.title);
            if (t === target) return true;
            // looser match only when we can corroborate with the year, and only when the IA
            // title *begins with* the full canonical name (so "saboteur" can't match "saboteur
            // 3d edition" away, but also can't match an unrelated same-year film)
            if (!year || target.length < 4) return false;
            return t.startsWith(target)
                && Math.abs((parseInt(d.year, 10) || 0) - year) <= 1;
        }).slice(0, 3);
    } catch (_) {
        return [];
    }
};

const iaFiles = async (identifier, episode, yearHint) => {
    try {
        const resp = await fetchWithTimeout(`${IA_META}${identifier}`, {}, 9000);
        if (!resp.ok) return [];
        const data = await resp.json();
        const files = Array.isArray(data.files) ? data.files : [];

        let vids = files.filter((f) => {
            if (!f.name || !VIDEO_EXT.test(f.name) || /\bthumb/i.test(f.name)) return false;
            if (SCENE_MARKER.test(f.name)) return false;
            // If the file name carries its own 4-digit year and it's well off the title's year,
            // it's a different film dumped into the same IA item (a real IA data-entry failure).
            if (yearHint) {
                const fy = (f.name.match(/\b(19\d\d|20\d\d)\b/) || [])[1];
                if (fy && Math.abs(parseInt(fy, 10) - yearHint) > 2) return false;
            }
            return true;
        });
        if (episode) {
            const { season, number } = episode;
            const rx = new RegExp(
                `(s0*${season}[ ._-]*e0*${number}\\b|\\b${season}x0*${number}\\b|\\bep?0*${number}\\b)`, 'i'
            );
            const matched = vids.filter((f) => rx.test(f.name));
            vids = matched.length ? matched : [];
        }

        vids.sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
        return vids.slice(0, 4).map((f) => ({
            url: `${IA_DL}${identifier}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
            name: f.name.replace(/^.*\//, ''),
            size: humanSize(f.size),
            webReady: WEB_READY_EXT.test(f.name)
        }));
    } catch (_) {
        return [];
    }
};

const handleStream = async (res, type, id) => {
    if (!id || !/^tt\d+/.test(id) || (type !== 'movie' && type !== 'series')) {
        return sendJson(res, 200, { streams: [] }, 300);
    }

    const [ttid, season, number] = id.split(':');
    const episode = (season !== undefined && number !== undefined)
        ? { season: parseInt(season, 10), number: parseInt(number, 10) }
        : null;

    const meta = await cinemetaMeta(type, ttid);
    if (!meta || !meta.name) return sendJson(res, 200, { streams: [] }, 1800);

    const candidates = await iaSearch(meta.name, meta.year);
    if (!candidates.length) return sendJson(res, 200, { streams: [] }, 3600);

    const perId = await Promise.all(candidates.map((c) => iaFiles(c.identifier, episode, meta.year)));

    const streams = [];
    perId.forEach((files, i) => {
        for (const f of files) {
            if (streams.length >= 8) break;
            streams.push({
                name: 'Internet Archive\nPublic Domain',
                title: [meta.name + (meta.year ? ` (${meta.year})` : ''), f.name, f.size]
                    .filter(Boolean).join('\n'),
                url: f.url,
                behaviorHints: {
                    bingeGroup: `wtsh-ia-${candidates[i].identifier}`,
                    notWebReady: !f.webReady
                }
            });
        }
    });

    return sendJson(res, 200, { streams }, 21600);
};

// -- catalog (TMDB) ---------------------------------------------------------------------------

const tmdbUrl = (path, params) => {
    const usp = new URLSearchParams({ api_key: process.env.TMDB_API_KEY, ...params });
    return `${TMDB_API_BASE}/${path}?${usp.toString()}`;
};

const resolveImdbId = async (tmdbType, tmdbId) => {
    try {
        const resp = await fetchWithTimeout(tmdbUrl(`${tmdbType}/${tmdbId}/external_ids`, {}), {}, 8000);
        if (!resp.ok) return null;
        const data = await resp.json();
        return typeof data.imdb_id === 'string' && /^tt\d+$/.test(data.imdb_id) ? data.imdb_id : null;
    } catch (_) {
        return null;
    }
};

const handleCatalog = async (res, type, catalogId, extra) => {
    if (!hasTmdb()) return sendJson(res, 200, { metas: [] }, 300);
    const def = CATALOGS[catalogId];
    if (!def || def.type !== type) return sendJson(res, 200, { metas: [] }, 300);

    const skip = Math.max(0, parseInt(extra.skip, 10) || 0);
    const page = Math.floor(skip / PAGE_SIZE) + 1;
    const search = (extra.search || '').trim();

    const listUrl = search
        ? tmdbUrl(`search/${def.tmdbType}`, { language: def.lang, page, query: search, include_adult: 'false' })
        : tmdbUrl(def.path, { language: def.lang, page, ...(def.discover || {}), include_adult: 'false' });

    let results;
    try {
        const resp = await fetchWithTimeout(listUrl, {}, 9000);
        if (!resp.ok) return sendJson(res, 200, { metas: [] }, 300);
        const data = await resp.json();
        results = Array.isArray(data.results) ? data.results.slice(0, PAGE_SIZE) : [];
    } catch (_) {
        return sendJson(res, 200, { metas: [] }, 300);
    }

    const resolved = await Promise.all(results.map(async (r) => {
        const imdbId = await resolveImdbId(def.tmdbType, r.id);
        if (!imdbId) return null;
        const year = (r.release_date || r.first_air_date || '').slice(0, 4);
        return {
            id: imdbId,
            type,
            name: r.title || r.name || r.original_title || r.original_name || 'Untitled',
            poster: r.poster_path ? `${TMDB_POSTER_BASE}${r.poster_path}` : undefined,
            posterShape: 'poster',
            background: r.backdrop_path ? `${TMDB_BACKDROP_BASE}${r.backdrop_path}` : undefined,
            description: r.overview || undefined,
            releaseInfo: year || undefined,
            imdbRating: r.vote_average ? Number(r.vote_average).toFixed(1) : undefined
        };
    }));

    return sendJson(res, 200, { metas: resolved.filter(Boolean) }, 43200);
};

// -- entrypoint -----------------------------------------------------------------------------

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        cors(res);
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        cors(res);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const segments = Array.isArray(req.query.path)
        ? req.query.path.slice()
        : (typeof req.query.path === 'string' ? [req.query.path] : []);

    if (segments.length === 0 || segments[0] === 'manifest.json' || segments[0] === 'manifest') {
        return sendJson(res, 200, buildManifest(), 3600);
    }

    const last = segments.length - 1;
    let tail = segments[last] || '';
    const dotJson = tail.endsWith('.json');
    if (dotJson) tail = tail.slice(0, -5);
    segments[last] = tail;

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${proto}://${host}`;

    const [resource, type, ...rest] = segments;

    if (resource === 'osfile') {
        return handleOsFile(res, tail.replace(/\.srt$/, ''));
    }

    if (resource === 'subtitles' && dotJson) {
        const id = rest[0] || '';
        const extra = parseExtra(rest[1], req.query);
        return handleSubtitles(res, type, id, extra, base);
    }

    if (resource === 'stream' && dotJson) {
        return handleStream(res, type, rest[0] || '');
    }

    if (resource === 'catalog' && dotJson) {
        const catalogId = rest[0] || '';
        const extra = parseExtra(rest[1], req.query);
        return handleCatalog(res, type, catalogId, extra);
    }

    cors(res);
    return res.status(404).json({ error: 'Not found' });
};
