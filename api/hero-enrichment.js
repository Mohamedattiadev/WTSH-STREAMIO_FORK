// Copyright (C) 2017-2026 Smart code 203358507

// Vercel serverless function - reuses the same TMDB_API_KEY api/reviews.js already reads.
// Backfills the Board hero's "Continue Watching" slides with a logo, description, runtime,
// genres and (when TMDB has one) a real trailer - fields stremio-core's own continue_watching_
// preview model doesn't carry, unlike a full catalog MetaItemPreview. Keyed off the same real
// IMDb id (Cinemeta-style, e.g. "tt0111161") every catalog/library item already carries as its
// own id.
//
// Also backfills the Search/Discover compact side-panel card (src/components/MetaPreview) the
// same way, when an addon's search-endpoint response for a title is thinner than its own
// catalog/browse response for that same title.
//
// Input:  GET /api/hero-enrichment?imdbId=tt...&type=movie|series
// Output: { logo, description, runtime, releaseInfo, genres, rating, trailerStreams, background }
//
// Caching: each (imdbId, type) result is cached via api/_lib/cache. Without it this did two
// sequential TMDB round trips (/find then /{type}/{id}?append_to_response=...) on every call.
// TTL comes from METADATA_CACHE_TTL - this data barely changes.

const { getCache, UpstreamError } = require('./_lib/cache');
const { CACHE_CONFIG } = require('./_lib/cache/config');
const { rawKey } = require('./_lib/cache/keys');
const { waitUntil } = require('./_lib/wait-until');
const { TMDB_API_BASE, tmdbFind } = require('./_lib/tmdb');

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

const EMPTY = { logo: null, description: null, runtime: null, releaseInfo: null, genres: [], rating: null, trailerStreams: [], background: null };

// Throws on upstream failure (so the cache layer can negative-cache it); otherwise returns the
// enrichment payload, including the all-null EMPTY shape for a title TMDB has nothing usable for.
const fetchEnrichment = async (imdbId, type) => {
    const apiKey = process.env.TMDB_API_KEY;

    // TMDB's own catalogs are keyed by their own numeric id, not IMDb's - the shared cached
    // /find lookup resolves the real IMDb id to it (coalesced with the reviews endpoint's own
    // /find for the same title). The app's own "series" type maps to TMDB's "tv".
    const { movieId, tvId } = await tmdbFind(imdbId);
    const match = movieId
        ? { id: movieId, tmdbType: 'movie' }
        : tvId
            ? { id: tvId, tmdbType: 'tv' }
            : typeof type === 'string' && type.length > 0
                ? { id: null, tmdbType: type === 'movie' ? 'movie' : 'tv' }
                : null;

    if (match === null || match.id === null) {
        return { ...EMPTY };
    }

    // One call for everything: base details plus images + videos sub-resources.
    const detailsResponse = await fetch(
        `${TMDB_API_BASE}/${match.tmdbType}/${match.id}?api_key=${apiKey}&append_to_response=images,videos&include_image_language=en,null`
    );
    if (!detailsResponse.ok) {
        throw new Error(`TMDB details returned ${detailsResponse.status}`);
    }
    const details = await detailsResponse.json();

    const genres = Array.isArray(details.genres)
        ? details.genres.filter((genre) => typeof genre?.name === 'string').map((genre) => genre.name)
        : [];

    const runtimeMinutes = match.tmdbType === 'movie'
        ? details.runtime
        : Array.isArray(details.episode_run_time) ? details.episode_run_time[0] : null;
    const runtime = typeof runtimeMinutes === 'number' && runtimeMinutes > 0 ? `${runtimeMinutes} min` : null;

    const releaseDate = match.tmdbType === 'movie' ? details.release_date : details.first_air_date;
    const releaseYearMatch = typeof releaseDate === 'string' ? releaseDate.match(/^\d{4}/) : null;
    const releaseInfo = releaseYearMatch ? releaseYearMatch[0] : null;

    const description = typeof details.overview === 'string' && details.overview.length > 0 ? details.overview : null;

    const logos = Array.isArray(details.images?.logos) ? details.images.logos : [];
    const preferredLogo = logos.find((logo) => logo.iso_639_1 === null) ?? logos.find((logo) => logo.iso_639_1 === 'en') ?? logos[0] ?? null;
    const logo = preferredLogo?.file_path ? `${TMDB_IMAGE_BASE}${preferredLogo.file_path}` : null;

    const trailerVideo = (Array.isArray(details.videos?.results) ? details.videos.results : [])
        .find((video) => video.site === 'YouTube' && video.type === 'Trailer' && typeof video.key === 'string');
    const trailerStreams = trailerVideo ? [{ ytId: trailerVideo.key }] : [];

    const rating = typeof details.vote_average === 'number' && details.vote_average > 0
        ? details.vote_average.toFixed(1)
        : null;

    const background = typeof details.backdrop_path === 'string' && details.backdrop_path.length > 0
        ? `${TMDB_BACKDROP_BASE}${details.backdrop_path}`
        : null;

    return { logo, description, runtime, releaseInfo, genres, rating, trailerStreams, background };
};

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
    const bypass = CACHE_CONFIG.allowBypass && /^(1|true|yes)$/i.test(String(req.query?.nocache ?? ''));

    try {
        const payload = await getCache().getOrFetch(
            rawKey('tmdb-hero', imdbId, normType),
            CACHE_CONFIG.ttl.metadata,
            () => fetchEnrichment(imdbId, normType),
            { bypass, waitUntil }
        );
        res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${CACHE_CONFIG.ttl.metadata}, stale-while-revalidate=604800`);
        res.status(200).json(payload);
    } catch (error) {
        if (!(error instanceof UpstreamError)) {
            console.error('Failed to fetch TMDB hero enrichment', error);
        }
        res.status(502).json({ error: 'Failed to fetch hero enrichment' });
    }
};

// Reused by api/board-hero.js (the combined hero+reviews endpoint).
module.exports.fetchEnrichment = fetchEnrichment;
module.exports.EMPTY = EMPTY;
module.exports.CACHE_KEY = (imdbId, normType) => rawKey('tmdb-hero', imdbId, normType);
module.exports.TTL = CACHE_CONFIG.ttl.metadata;
