// Copyright (C) 2017-2026 Smart code 203358507

// Combined Board-hero endpoint: the enrichment payload (logo/description/runtime/genres/
// trailer/background) AND the TMDB reviews for one title, in a single request.
//
//   GET /api/board-hero?imdbId=tt...&type=movie|series
//   -> { enrichment: { logo, description, ... }, reviews: [ { author, rating, content, url } ],
//        partial: boolean }
//
// It is a pure fan-in over the SAME cache entries api/hero-enrichment.js and api/reviews.js
// already fill - no duplicate storage. When both are warm it's ~2 cache reads; when cold the two
// fetches run in parallel and share ONE TMDB /find call (see api/_lib/tmdb.js's coalescing).
// The two standalone endpoints keep working unchanged; the client can switch to this one to save
// a round trip whenever it's convenient.

const { getCache, UpstreamError } = require('./_lib/cache');
const { waitUntil } = require('./_lib/wait-until');
const heroMod = require('./hero-enrichment');
const reviewsMod = require('./reviews');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { imdbId, type } = req.query ?? {};
    if (typeof imdbId !== 'string' || !/^tt\d+$/.test(imdbId)) {
        res.status(400).json({ error: 'Expected ?imdbId=tt<digits>' });
        return;
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
        res.status(503).json({ error: 'TMDB_API_KEY is not configured on the server' });
        return;
    }

    const normType = type === 'movie' || type === 'series' ? type : '';
    const cache = getCache();
    const heroKey = heroMod.CACHE_KEY(imdbId, normType);
    const reviewsKey = reviewsMod.CACHE_KEY(imdbId);

    // one batched read of both existing entries
    const [cachedHero, cachedReviews] = await cache.mget([heroKey, reviewsKey]);

    const resolve = async (cached, key, ttl, fetchFn) => {
        if (cached !== null) return { value: cached, ok: true };
        try {
            const value = await cache.getOrFetch(key, ttl, fetchFn, { waitUntil });
            return { value, ok: true };
        } catch (err) {
            if (!(err instanceof UpstreamError)) throw err;
            return { value: null, ok: false };
        }
    };

    const [hero, reviews] = await Promise.all([
        resolve(cachedHero, heroKey, heroMod.TTL, () => heroMod.fetchEnrichment(imdbId, normType)),
        resolve(cachedReviews, reviewsKey, reviewsMod.TTL, () => reviewsMod.fetchReviews(imdbId, apiKey)),
    ]);

    if (!hero.ok && !reviews.ok) {
        res.status(502).json({ error: 'Failed to fetch board hero' });
        return;
    }

    res.setHeader(
        'Cache-Control',
        `public, max-age=0, s-maxage=${reviewsMod.TTL}, stale-while-revalidate=86400`
    );
    res.status(200).json({
        enrichment: hero.ok ? hero.value : { ...heroMod.EMPTY },
        reviews: reviews.ok && reviews.value ? reviews.value.reviews : [],
        partial: !hero.ok || !reviews.ok,
    });
};
