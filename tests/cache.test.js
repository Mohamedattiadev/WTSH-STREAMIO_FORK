// Copyright (C) 2017-2026 Smart code 203358507

// Tests for the cache / proxy layer (api/_lib/cache). Covers the matrix the brief calls out:
// cache hit, cache miss, TTL expiry, concurrent identical requests (in-process AND cross-
// instance via the redis lock), upstream failure + negative cache, stale-while-revalidate,
// redis failure fail-open, key normalisation, the Telegram object-store adapter, SSRF guard,
// malformed requests, and admin-endpoint authorization.

const { Cache, UpstreamError } = require('../api/_lib/cache');
const { metrics } = require('../api/_lib/cache/metrics');
const KEYS = require('../api/_lib/cache/keys');
const { assertAllowedUrl, hostAllowed, SsrfBlockedError } = require('../api/_lib/http');

const realFetch = global.fetch;

beforeEach(() => {
    metrics.reset();
});
afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
});

// --- a fake Upstash-REST redis: one shared Map, understands the handful of verbs we use ------
const makeFakeRedis = () => {
    const store = new Map();
    const runOne = (cmd, rest) => {
        switch (cmd) {
            case 'INCRBY': {
                const cur = Number(store.get(rest[0]) || 0) + Number(rest[1]);
                store.set(rest[0], String(cur));
                return cur;
            }
            default:
                return null;
        }
    };
    const fn = jest.fn(async (url, opts) => {
        if (String(url).endsWith('/pipeline')) {
            const cmds = JSON.parse(opts.body);
            return { ok: true, status: 200, json: async () => cmds.map(([c, ...r]) => ({ result: runOne(c, r) })) };
        }
        const [cmd, ...rest] = JSON.parse(opts.body);
        let result = null;
        switch (cmd) {
            case 'GET':
                result = store.has(rest[0]) ? store.get(rest[0]) : null;
                break;
            case 'MGET':
                result = rest.map((k) => (store.has(k) ? store.get(k) : null));
                break;
            case 'SET': {
                const hasNX = rest.includes('NX');
                if (hasNX && store.has(rest[0])) { result = null; break; }
                store.set(rest[0], rest[1]);
                result = 'OK';
                break;
            }
            case 'DEL':
                result = store.delete(rest[0]) ? 1 : 0;
                break;
            case 'EXISTS':
                result = store.has(rest[0]) ? 1 : 0;
                break;
            case 'PTTL':
                result = store.has(rest[0]) ? 10000 : -2;
                break;
            case 'INCRBY': {
                const cur = Number(store.get(rest[0]) || 0) + Number(rest[1]);
                store.set(rest[0], String(cur));
                result = cur;
                break;
            }
            case 'DBSIZE':
                result = store.size;
                break;
            default:
                result = null;
        }
        return { ok: true, status: 200, json: async () => ({ result }) };
    });
    fn.store = store;
    return fn;
};

const memCache = (over = {}) => new Cache({ backend: 'memory', lock: { enabled: false }, negativeTtl: 0, ...over });

describe('simple get / set / del / exists', () => {
    test('round trips a value and honours del', async () => {
        const c = memCache();
        expect(await c.get('k')).toBeNull();
        await c.set('k', { a: 1 }, 60);
        expect(await c.get('k')).toEqual({ a: 1 });
        expect(await c.exists('k')).toBe(true);
        await c.del('k');
        expect(await c.get('k')).toBeNull();
        expect(await c.exists('k')).toBe(false);
    });
});

describe('stat counters are pipelined, not one call per bump', () => {
    test('a run of getOrFetch calls flushes buffered counts as /pipeline requests', async () => {
        const fake = makeFakeRedis();
        global.fetch = fake;
        const c = new Cache({ backend: 'redis', redis: { url: 'http://fake', token: 't', timeoutMs: 500 }, lock: { enabled: false }, swr: { enabled: false }, negativeTtl: 0 });

        for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            await c.getOrFetch(`k${i}`, 60, () => i);
        }
        await c.stats(); // final flush

        const pipelineCalls = fake.mock.calls.filter(([u]) => String(u).endsWith('/pipeline'));
        const bareIncr = fake.mock.calls.filter(([, o]) => JSON.parse(o.body)[0] === 'INCRBY');
        expect(pipelineCalls.length).toBeGreaterThan(0);
        expect(bareIncr.length).toBe(0); // never a standalone INCRBY per counter

        // each pipeline body is an array of ["INCRBY", key, n] tuples
        const firstBody = JSON.parse(pipelineCalls[0][1].body);
        expect(Array.isArray(firstBody)).toBe(true);
        expect(firstBody.every((cmd) => cmd[0] === 'INCRBY')).toBe(true);
    });
});

describe('mget: batched read', () => {
    test('returns values aligned to keys; null for misses; one call on redis', async () => {
        const fake = makeFakeRedis();
        global.fetch = fake;
        const c = new Cache({ backend: 'redis', redis: { url: 'http://fake', token: 't', timeoutMs: 500 }, lock: { enabled: false }, swr: { enabled: false }, negativeTtl: 0 });
        await c.set('a', { v: 1 }, 60);
        await c.set('c', { v: 3 }, 60);
        fake.mockClear();
        const out = await c.mget(['a', 'b', 'c']);
        expect(out).toEqual([{ v: 1 }, null, { v: 3 }]);
        const mgetCalls = fake.mock.calls.filter(([, o]) => JSON.parse(o.body)[0] === 'MGET');
        expect(mgetCalls).toHaveLength(1);
    });
});

describe('getOrFetch: hit vs miss', () => {
    test('fetchFn runs once on miss, never again on a hit', async () => {
        const c = memCache({ swr: { enabled: false } });
        let calls = 0;
        const fn = () => ({ n: ++calls });

        expect(await c.getOrFetch('k', 60, fn)).toEqual({ n: 1 });
        expect(await c.getOrFetch('k', 60, fn)).toEqual({ n: 1 });
        expect(await c.getOrFetch('k', 60, fn)).toEqual({ n: 1 });
        expect(calls).toBe(1);

        const snap = metrics.snapshot();
        expect(snap.counters.misses).toBe(1);
        expect(snap.counters.hits).toBe(2);
        expect(snap.counters.upstreamCalls).toBe(1);
    });
});

describe('getOrFetch: TTL expiry', () => {
    test('a value past its TTL is re-fetched', async () => {
        jest.useFakeTimers();
        const c = memCache({ swr: { enabled: false } });
        let calls = 0;
        const fn = () => ++calls;

        await c.getOrFetch('k', 10, fn);
        await c.getOrFetch('k', 10, fn);
        expect(calls).toBe(1);

        jest.advanceTimersByTime(11_000);

        await c.getOrFetch('k', 10, fn);
        expect(calls).toBe(2);
    });
});

describe('getOrFetch: request deduplication (in-process single-flight)', () => {
    test('50 concurrent identical misses => exactly ONE upstream call', async () => {
        const c = memCache({ swr: { enabled: false } });
        let calls = 0;
        const fn = () => new Promise((resolve) => setTimeout(() => resolve(++calls), 25));

        const results = await Promise.all(Array.from({ length: 50 }, () => c.getOrFetch('same', 60, fn)));

        expect(calls).toBe(1);
        expect(results.every((r) => r === 1)).toBe(true);
        expect(metrics.snapshot().counters.coalesced).toBe(49);
    });
});

describe('getOrFetch: request deduplication (cross-instance redis lock)', () => {
    test('two independent Cache instances sharing one redis => ONE upstream call', async () => {
        global.fetch = makeFakeRedis();
        const opts = {
            backend: 'redis',
            redis: { url: 'http://fake', token: 't', timeoutMs: 500 },
            lock: { enabled: true, ttlMs: 5000, pollMs: 10, maxWaitMs: 2000 },
            swr: { enabled: false },
            negativeTtl: 0,
        };
        const a = new Cache(opts);
        const b = new Cache(opts);

        let calls = 0;
        const fn = () => new Promise((resolve) => setTimeout(() => resolve(++calls), 50));

        const [ra, rb] = await Promise.all([
            a.getOrFetch('shared', 60, fn),
            b.getOrFetch('shared', 60, fn),
        ]);

        expect(calls).toBe(1);
        expect(ra).toBe(1);
        expect(rb).toBe(1);
    });
});

describe('getOrFetch: upstream failure + negative cache (anti-stampede)', () => {
    test('a failing upstream is called once, then negative-cached until it expires', async () => {
        jest.useFakeTimers();
        const c = memCache({ swr: { enabled: false }, negativeTtl: 60 });
        let calls = 0;
        const boom = () => { calls += 1; throw new Error('upstream 500'); };

        await expect(c.getOrFetch('k', 10, boom)).rejects.toBeInstanceOf(UpstreamError);
        expect(calls).toBe(1);

        // within the negative window: served from the sentinel, upstream NOT hit again
        await expect(c.getOrFetch('k', 10, boom)).rejects.toMatchObject({ cachedFailure: true });
        expect(calls).toBe(1);

        jest.advanceTimersByTime(61_000);
        await expect(c.getOrFetch('k', 10, boom)).rejects.toBeInstanceOf(UpstreamError);
        expect(calls).toBe(2);
    });

    test('a stale value is served when the refresh fails (allowStaleOnError)', async () => {
        const c = memCache({ swr: { enabled: false } });
        await c.getOrFetch('k', 60, () => 'good');
        const v = await c.getOrFetch('k', 0, () => { throw new Error('down'); }, { allowStaleOnError: true });
        expect(v).toBe('good');
    });
});

describe('getOrFetch: stale-while-revalidate', () => {
    test('returns the stale value immediately and refreshes in the background', async () => {
        jest.useFakeTimers();
        const c = memCache({ swr: { enabled: true, graceRatio: 5 } });

        await c.getOrFetch('k', 1, () => 'v1');
        jest.advanceTimersByTime(1500); // now stale, still inside the grace window

        let bg;
        const served = await c.getOrFetch('k', 1, () => 'v2', { waitUntil: (p) => { bg = p; } });
        expect(served).toBe('v1');

        await bg;
        expect(await c.get('k')).toBe('v2');
        expect(metrics.snapshot().counters.staleHits).toBe(1);
    });

    test('does NOT serve stale when swr is disabled for the call', async () => {
        jest.useFakeTimers();
        const c = memCache({ swr: { enabled: true, graceRatio: 5 } });
        await c.getOrFetch('k', 1, () => 'v1');
        jest.advanceTimersByTime(1500);
        const v = await c.getOrFetch('k', 1, () => 'v2', { swr: false });
        expect(v).toBe('v2'); // refreshed synchronously
    });
});

describe('redis backend', () => {
    test('uses the REST wire format and serves the second call from redis', async () => {
        const fake = makeFakeRedis();
        global.fetch = fake;
        const c = new Cache({
            backend: 'redis',
            redis: { url: 'http://fake', token: 't', timeoutMs: 500 },
            lock: { enabled: false },
            swr: { enabled: false },
            negativeTtl: 0,
        });
        let calls = 0;
        await c.getOrFetch('rk', 60, () => ({ n: ++calls }));
        const second = await c.getOrFetch('rk', 60, () => ({ n: ++calls }));
        expect(calls).toBe(1);
        expect(second).toEqual({ n: 1 });
        // a SET carrying an EX ttl was issued
        const setCall = fake.mock.calls.find(([, o]) => JSON.parse(o.body)[0] === 'SET');
        expect(JSON.parse(setCall[1].body)).toEqual(expect.arrayContaining(['SET', 'rk', 'EX']));
    });

    test('redis failure fails open to a live fetch (no throw) and is counted', async () => {
        global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
        const c = new Cache({
            backend: 'redis',
            redis: { url: 'http://down', token: 't', timeoutMs: 100 },
            lock: { enabled: false },
            swr: { enabled: false },
            negativeTtl: 0,
        });
        const v = await c.getOrFetch('k', 60, () => 'fresh');
        expect(v).toBe('fresh');
        expect(metrics.snapshot().counters.redisErrors).toBeGreaterThan(0);
    });
});

describe('cache key normalisation', () => {
    test('equivalent requests collapse to one key', () => {
        expect(KEYS.metadataKey('Cinemeta', 'Movie', 'TT0111161'))
            .toBe(KEYS.metadataKey('cinemeta', 'movie', 'tt0111161'));

        expect(KEYS.metadataKey('cinemeta', 'movie', '0111161'))
            .toBe(KEYS.metadataKey('cinemeta', 'movie', 'tt0111161'));

        expect(KEYS.catalogKey('a', 'movie', 'c', { b: '2', a: '1' }))
            .toBe(KEYS.catalogKey('a', 'movie', 'c', 'a=1&b=2'));

        expect(KEYS.catalogKey('a', 'movie', 'c', { skip: '0', genre: '', search: '  Foo Bar ' }))
            .toBe(KEYS.catalogKey('a', 'movie', 'c', { search: 'foo bar', skip: '0' }));

        expect(KEYS.subtitlesKey('wtsh', 'tt99:1:2', 'EN'))
            .toBe(KEYS.subtitlesKey('wtsh', 'tt99:01:02', 'en'));
    });
});

describe('SSRF guard', () => {
    test('blocks link-local, off-list and non-http targets; allows configured hosts', () => {
        expect(() => assertAllowedUrl('http://169.254.169.254/latest/meta-data/')).toThrow(SsrfBlockedError);
        expect(() => assertAllowedUrl('https://evil.example.com/x')).toThrow(SsrfBlockedError);
        expect(() => assertAllowedUrl('file:///etc/passwd')).toThrow(SsrfBlockedError);
        expect(() => assertAllowedUrl('not a url')).toThrow(SsrfBlockedError);

        expect(assertAllowedUrl('https://api.themoviedb.org/3/movie/1').hostname).toBe('api.themoviedb.org');
        expect(hostAllowed('image.tmdb.org')).toBe(true);
        expect(hostAllowed('archive.org')).toBe(true);
        expect(hostAllowed('api.themoviedb.org.evil.com')).toBe(false);
    });
});

describe('Telegram object store adapter', () => {
    const clearEnv = () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
        delete process.env.TELEGRAM_STORAGE_ENABLED;
        delete process.env.OBJECT_STORAGE;
    };
    afterEach(() => {
        clearEnv();
        jest.resetModules();
    });

    test('put -> get round trip; the bot token never appears in the returned reference', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'SECRET_BOT_TOKEN';
        process.env.TELEGRAM_CHAT_ID = '-1001234567890';
        const { createTelegramStore } = require('../api/_lib/object-store/telegram');
        const store = createTelegramStore();
        expect(store.enabled).toBe(true);

        global.fetch = jest.fn(async (url) => {
            const u = String(url);
            if (u.includes('/sendDocument')) {
                return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 7, document: { file_id: 'TG_FILE_ID' } } }) };
            }
            if (u.includes('/getFile')) {
                return { ok: true, status: 200, json: async () => ({ ok: true, result: { file_path: 'documents/file_7.bin' } }) };
            }
            return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\nhi\n').buffer };
        });

        const ref = await store.put('sub:tt1:eng', Buffer.from('srt bytes'), { contentType: 'application/x-subrip' });
        expect(ref).toMatchObject({ storage: 'telegram', object_id: 'TG_FILE_ID', message_id: 7 });
        expect(JSON.stringify(ref)).not.toContain('SECRET_BOT_TOKEN');

        const blob = await store.get(ref);
        expect(blob.buffer.toString('utf-8')).toContain('00:00:01,000');
    });

    test('with nothing configured the store is a disabled no-op', async () => {
        jest.resetModules();
        clearEnv();
        const { getObjectStore } = require('../api/_lib/object-store');
        const store = getObjectStore();
        expect(store.enabled).toBe(false);
        expect(await store.put('x', Buffer.from('y'))).toBeNull();
        expect(await store.get({ storage: 'telegram', object_id: 'z' })).toBeNull();
    });
});

// --- HTTP handler tests: run each in an isolated module registry so config.js re-reads env ---
const mockRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.send = (b) => { res.body = b; return res; };
    return res;
};

describe('/api/cache-stats authorization', () => {
    const OLD = process.env.CACHE_STATS_TOKEN;
    afterEach(() => {
        if (OLD === undefined) delete process.env.CACHE_STATS_TOKEN;
        else process.env.CACHE_STATS_TOKEN = OLD;
        jest.resetModules();
    });

    test('403 when CACHE_STATS_TOKEN is unset (endpoint disabled by default)', async () => {
        await jest.isolateModulesAsync(async () => {
            delete process.env.CACHE_STATS_TOKEN;
            const handler = require('../api/cache-stats');
            const res = mockRes();
            await handler({ method: 'GET', headers: {}, query: {} }, res);
            expect(res.statusCode).toBe(403);
        });
    });

    test('401 with a wrong token', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.CACHE_STATS_TOKEN = 'the-real-admin-token';
            const handler = require('../api/cache-stats');
            const res = mockRes();
            await handler({ method: 'GET', headers: {}, query: { token: 'wrong' } }, res);
            expect(res.statusCode).toBe(401);
        });
    });

    test('200 + stats payload with the correct token', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.CACHE_STATS_TOKEN = 'the-real-admin-token';
            const handler = require('../api/cache-stats');
            const res = mockRes();
            await handler({ method: 'GET', headers: { 'x-cache-stats-token': 'the-real-admin-token' }, query: {} }, res);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('backend');
            expect(res.body).toHaveProperty('instanceMetrics.counters');
        });
    });
});

describe('/api/cron/prefetch authorization', () => {
    afterEach(() => {
        delete process.env.PREFETCH_ENABLED;
        delete process.env.CRON_SECRET;
        jest.resetModules();
    });

    test('skips quietly when PREFETCH_ENABLED is not set', async () => {
        await jest.isolateModulesAsync(async () => {
            const handler = require('../api/cron/prefetch');
            const res = mockRes();
            await handler({ method: 'GET', headers: {}, query: {} }, res);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('skipped');
        });
    });

    test('403 when enabled but CRON_SECRET is missing; 401 on a bad bearer', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.PREFETCH_ENABLED = 'true';
            const handler = require('../api/cron/prefetch');
            const noSecret = mockRes();
            await handler({ method: 'GET', headers: {}, query: {} }, noSecret);
            expect(noSecret.statusCode).toBe(403);

            process.env.CRON_SECRET = 'cron-secret-value';
            const badBearer = mockRes();
            await handler({ method: 'GET', headers: { authorization: 'Bearer nope' }, query: {} }, badBearer);
            expect(badBearer.statusCode).toBe(401);
        });
    });
});

describe('/api/board-hero combined endpoint', () => {
    afterEach(() => {
        delete process.env.TMDB_API_KEY;
        jest.resetModules();
    });

    test('one /find feeds both halves; returns { enrichment, reviews, partial:false }', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.TMDB_API_KEY = 'k';
            let findCalls = 0;
            global.fetch = jest.fn(async (url) => {
                const u = String(url);
                if (u.includes('/find/')) {
                    findCalls += 1;
                    return { ok: true, status: 200, json: async () => ({ movie_results: [{ id: 99 }], tv_results: [] }) };
                }
                if (u.includes('/movie/99?') && u.includes('append_to_response')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            genres: [{ name: 'Drama' }],
                            runtime: 142,
                            overview: 'Two imprisoned men bond.',
                            release_date: '1994-09-23',
                            images: { logos: [] },
                            videos: { results: [] },
                            vote_average: 8.7,
                            backdrop_path: '/b.jpg',
                        }),
                    };
                }
                if (u.includes('/movie/99/reviews')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ results: [{ author: 'a', content: 'great', url: 'http://x', author_details: { rating: 8 } }] }),
                    };
                }
                return { ok: false, status: 404, json: async () => ({}) };
            });

            const handler = require('../api/board-hero');
            const res = mockRes();
            await handler({ method: 'GET', headers: {}, query: { imdbId: 'tt0111161', type: 'movie' } }, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.enrichment.genres).toEqual(['Drama']);
            expect(res.body.enrichment.rating).toBe('8.7');
            expect(res.body.reviews).toHaveLength(1);
            expect(res.body.partial).toBe(false);
            expect(findCalls).toBe(1); // the two halves shared one /find via tmdbFind coalescing
        });
    });

    test('400 on a bad imdbId', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.TMDB_API_KEY = 'k';
            const handler = require('../api/board-hero');
            const res = mockRes();
            await handler({ method: 'GET', headers: {}, query: { imdbId: 'bad' } }, res);
            expect(res.statusCode).toBe(400);
        });
    });
});

describe('/api/reviews malformed-request handling', () => {
    test('400 on a non-imdb id, 405 on POST', async () => {
        await jest.isolateModulesAsync(async () => {
            const handler = require('../api/reviews');
            const bad = mockRes();
            await handler({ method: 'GET', query: { imdbId: 'nope' } }, bad);
            expect(bad.statusCode).toBe(400);

            const wrongMethod = mockRes();
            await handler({ method: 'POST', query: {} }, wrongMethod);
            expect(wrongMethod.statusCode).toBe(405);
        });
    });
});
