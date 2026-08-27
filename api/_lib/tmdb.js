// Copyright (C) 2017-2026 Smart code 203358507

// Shared TMDB helpers. `tmdbFind` resolves an IMDb id to TMDB's own numeric ids - a mapping
// that never changes, so it is cached for ID_MAP_CACHE_TTL and shared by every server function
// that needs it (api/reviews.js, api/hero-enrichment.js, api/board-hero.js). A page that renders
// the hero AND the reviews row for one title now costs ONE /find upstream call rather than one
// per endpoint: the cache's single-flight coalesces the concurrent lookups onto the same key.

const { getCache } = require('./cache');
const { CACHE_CONFIG } = require('./cache/config');
const KEYS = require('./cache/keys');
const { fetchJson } = require('./http');

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

// -> { movieId: number|null, tvId: number|null }
const tmdbFind = (imdbId) => {
    const apiKey = process.env.TMDB_API_KEY;
    return getCache().getOrFetch(
        KEYS.idMapKey('imdb', 'tmdb-find', imdbId),
        CACHE_CONFIG.ttl.idMap,
        async () => {
            const data = await fetchJson(
                `${TMDB_API_BASE}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`,
                {},
                8000
            );
            return {
                movieId: data.movie_results && data.movie_results[0] ? data.movie_results[0].id : null,
                tvId: data.tv_results && data.tv_results[0] ? data.tv_results[0].id : null,
            };
        },
        { swr: false } // an imdb->tmdb mapping doesn't drift; no point background-refreshing it
    );
};

module.exports = { TMDB_API_BASE, tmdbFind };
