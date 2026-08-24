// Copyright (C) 2017-2026 Smart code 203358507

// Free-text -> structured-query parsing and catalog-grounded candidate ranking
// for the Chat route. Everything here is a pure function operating on data
// already fetched via useSearch (see useChatSession.js) - nothing in this
// file performs network requests, so results can never include an item that
// wasn't actually present in an installed addon's catalog response.

// Small, deliberately-incomplete keyword -> genre map. Genre names on the
// right must match the capitalization addons use in `links[].name` for
// `links[].category === 'genres'` (Cinemeta-style, e.g. "Science Fiction").
// Extend freely - unmatched words just fall through to free-text matching.
const GENRE_KEYWORDS = {
    'funny': 'Comedy',
    'comedy': 'Comedy',
    'comedic': 'Comedy',
    'hilarious': 'Comedy',
    'scary': 'Horror',
    'horror': 'Horror',
    'terrifying': 'Horror',
    'creepy': 'Horror',
    'sci-fi': 'Science Fiction',
    'scifi': 'Science Fiction',
    'sci fi': 'Science Fiction',
    'science fiction': 'Science Fiction',
    'action': 'Action',
    'action-packed': 'Action',
    'romantic': 'Romance',
    'romance': 'Romance',
    'thriller': 'Thriller',
    'suspenseful': 'Thriller',
    'animated': 'Animation',
    'animation': 'Animation',
    'cartoon': 'Animation',
    'documentary': 'Documentary',
    'kids': 'Family',
    'family': 'Family',
    'family-friendly': 'Family',
    'fantasy': 'Fantasy',
    'adventure': 'Adventure',
    'crime': 'Crime',
    'mystery': 'Mystery',
    'mysterious': 'Mystery',
    'drama': 'Drama',
    'dramatic': 'Drama',
    'musical': 'Musical',
    'war': 'War',
    'western': 'Western',
    'heartwarming': 'Drama'
};

// Filler words stripped out while deriving the free-text fallback query, so
// e.g. "find me something funny to watch" reduces to just "" once "funny"
// is consumed as a genre keyword, rather than searching for filler noise.
const STOPWORDS = new Set([
    'a', 'an', 'the', 'me', 'my', 'i', 'to', 'for', 'of', 'is', 'are', 'that', 'which',
    'find', 'show', 'give', 'recommend', 'suggest', 'suggestion', 'suggestions',
    'something', 'some', 'anything', 'please', 'can', 'you', 'watch', 'want', 'with',
    'movie', 'movies', 'film', 'films', 'show', 'shows', 'series', 'like'
]);

const RUNTIME_PATTERN = /\b(?:under|less than|shorter than|within|no more than|max(?:imum)?)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;
const RUNTIME_SUFFIX_PATTERN = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\s*(?:or less|or under)\b/i;
const REFERENCE_PATTERN = /\blike\s+([a-z0-9][^.,!?;]*)/i;
const REFERENCE_CUTOFF_PATTERN = /\s+\b(?:but|and|that|which|under|within|less than|shorter than)\b.*$/i;

const isHourUnit = (unit) => /^h/i.test(unit);

// Extracts { minutes } from an "under N hours/minutes" style phrase, or null.
const parseRuntimeConstraint = (text) => {
    const match = text.match(RUNTIME_PATTERN) || text.match(RUNTIME_SUFFIX_PATTERN);
    if (!match) {
        return null;
    }

    const amount = parseFloat(match[1]);
    if (Number.isNaN(amount)) {
        return null;
    }

    return isHourUnit(match[2]) ? Math.round(amount * 60) : Math.round(amount);
};

// Extracts the free-text title mentioned after "like " (e.g. "...like Interstellar").
const parseReferenceTitle = (text) => {
    const match = text.match(REFERENCE_PATTERN);
    if (!match) {
        return null;
    }

    const trimmed = match[1].replace(REFERENCE_CUTOFF_PATTERN, '').trim();
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * Parses a free-text chat question into structured retrieval signals.
 * @param {string} text
 * @returns {{ raw: string, genres: string[], maxRuntimeMinutes: number|null, referenceTitle: string|null, freeText: string }}
 */
const parseQuery = (text) => {
    const raw = typeof text === 'string' ? text.trim() : '';
    const normalized = raw.toLowerCase();

    const genres = Array.from(new Set(
        Object.keys(GENRE_KEYWORDS)
            .filter((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized))
            .map((keyword) => GENRE_KEYWORDS[keyword])
    ));

    const maxRuntimeMinutes = parseRuntimeConstraint(normalized);
    const referenceTitle = parseReferenceTitle(raw);

    // Build the free-text fallback by stripping out everything already
    // captured as a structured signal, plus filler stopwords.
    let leftover = normalized;
    if (referenceTitle !== null) {
        leftover = leftover.replace(REFERENCE_PATTERN, ' ');
    }
    leftover = leftover.replace(RUNTIME_PATTERN, ' ').replace(RUNTIME_SUFFIX_PATTERN, ' ');
    Object.keys(GENRE_KEYWORDS)
        .sort((a, b) => b.length - a.length)
        .forEach((keyword) => {
            leftover = leftover.replace(new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
        });
    const freeText = leftover
        .split(/\s+/)
        .filter((word) => word.length > 0 && !STOPWORDS.has(word))
        .join(' ')
        .trim();

    return { raw, genres, maxRuntimeMinutes, referenceTitle, freeText };
};

// Reads the `genres` category out of a meta item's `links` array.
const extractGenres = (item) => {
    return Array.isArray(item?.links) ?
        item.links
            .filter((link) => typeof link?.category === 'string' && link.category.toLowerCase() === 'genres' && typeof link?.name === 'string')
            .map((link) => link.name)
        :
        [];
};

// Parses a free-form `runtime` string ("148 min", "2h 5min", "90", ...) into minutes, or null.
const parseRuntimeMinutes = (runtime) => {
    if (typeof runtime !== 'string' || runtime.trim().length === 0) {
        return null;
    }

    const hourMatch = runtime.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/i);
    const minMatch = runtime.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?\b/i);
    if (hourMatch || minMatch) {
        const hours = hourMatch ? parseFloat(hourMatch[1]) : 0;
        const mins = minMatch ? parseFloat(minMatch[1]) : 0;
        return Math.round(hours * 60 + mins);
    }

    const bareNumber = runtime.trim().match(/^(\d+(?:\.\d+)?)$/);
    return bareNumber ? Math.round(parseFloat(bareNumber[1])) : null;
};

const matchRank = (name, query) => {
    if (typeof name !== 'string' || typeof query !== 'string' || query.length === 0) {
        return 3;
    }

    const normalizedName = name.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    if (normalizedName === normalizedQuery) {
        return 0;
    }
    if (normalizedName.startsWith(normalizedQuery)) {
        return 1;
    }
    if (normalizedName.includes(normalizedQuery)) {
        return 2;
    }
    return 3;
};

/**
 * Picks the item in `items` whose name best matches `title` (used to resolve
 * a "like <title>" reference against the catalog results actually fetched
 * for that title). Returns null when `items` is empty.
 */
const resolveReferenceItem = (items, title) => {
    if (!Array.isArray(items) || items.length === 0 || typeof title !== 'string') {
        return null;
    }

    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const rankDiff = matchRank(a.item.name, title) - matchRank(b.item.name, title);
            return rankDiff !== 0 ? rankDiff : a.index - b.index;
        })[0].item;
};

const formatRuntimeLabel = (item) => {
    if (typeof item.runtime === 'string' && item.runtime.trim().length > 0) {
        return item.runtime.trim();
    }

    const minutes = parseRuntimeMinutes(item.runtime);
    return typeof minutes === 'number' ? `${minutes} min` : null;
};

const buildMatchReason = (item, itemGenres, overlap, referenceItem) => {
    const parts = [];
    if (overlap.length > 0) {
        parts.push(overlap.slice(0, 2).join(' & '));
    } else if (itemGenres.length > 0) {
        parts.push(itemGenres[0]);
    }

    const runtimeLabel = formatRuntimeLabel(item);
    if (runtimeLabel !== null) {
        parts.push(runtimeLabel);
    }

    if (referenceItem !== null && overlap.length > 0) {
        parts.push(`shares ${overlap.length} genre${overlap.length === 1 ? '' : 's'} with ${referenceItem.name}`);
    }

    return parts.join(' · ');
};

const sameItem = (a, b) => {
    if (!a || !b) {
        return false;
    }
    if (typeof a.id === 'string' && typeof b.id === 'string') {
        return a.id === b.id && a.type === b.type;
    }
    return a.name === b.name && a.type === b.type;
};

/**
 * Ranks/filters an already-fetched pool of catalog items against a parsed
 * query. Never invents items - only reorders/annotates/drops what's in
 * `items`. Returns [] (never null/undefined) when nothing matches so the
 * caller can render an honest "no results" answer.
 *
 * @param {ReturnType<typeof parseQuery>} parsed
 * @param {Array<object>} items - flattened meta items from Ready search catalogs
 * @param {object|null} referenceItem - resolved via resolveReferenceItem(), if any
 * @param {number} [limit]
 */
const retrieveCandidates = (parsed, items, referenceItem = null, limit = 20) => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const referenceGenres = referenceItem !== null ? extractGenres(referenceItem) : [];
    const effectiveGenres = Array.from(new Set([...parsed.genres, ...referenceGenres].map((g) => g.toLowerCase())));
    const hasSpecificAsk = effectiveGenres.length > 0 || parsed.freeText.length > 0;

    const runtimeFiltered = items
        .filter((item) => !sameItem(item, referenceItem))
        .filter((item) => {
            if (parsed.maxRuntimeMinutes === null) {
                return true;
            }
            const minutes = parseRuntimeMinutes(item.runtime);
            return minutes === null || minutes <= parsed.maxRuntimeMinutes;
        });

    const scored = runtimeFiltered.map((item, index) => {
        const itemGenres = extractGenres(item);
        const overlap = itemGenres.filter((g) => effectiveGenres.includes(g.toLowerCase()));
        const textHit = parsed.freeText.length > 0 && (
            (typeof item.name === 'string' && item.name.toLowerCase().includes(parsed.freeText)) ||
            (typeof item.description === 'string' && item.description.toLowerCase().includes(parsed.freeText))
        );
        const score = overlap.length * 10 + (textHit ? 5 : 0);
        return {
            item,
            index,
            score,
            matchReason: buildMatchReason(item, itemGenres, overlap, referenceItem)
        };
    });

    const ranked = hasSpecificAsk ? scored.filter((entry) => entry.score > 0) : scored;

    return ranked
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, limit)
        .map(({ item, matchReason }) => ({ ...item, matchReason }));
};

module.exports = {
    GENRE_KEYWORDS,
    parseQuery,
    extractGenres,
    parseRuntimeMinutes,
    resolveReferenceItem,
    retrieveCandidates
};
