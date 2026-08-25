// Copyright (C) 2017-2026 Smart code 203358507

// Vercel serverless function - the only place TMDB_API_KEY is ever read. Powers the Board hero's
// "What people are saying" row (src/routes/Board/ReviewsRow) with real TMDB user reviews, keyed
// off the same real IMDb id (Cinemeta-style, e.g. "tt0111161") every catalog item already
// carries as its own id. Never returns anything but what TMDB itself actually has - an empty
// `reviews` array when a title has none, never a fabricated quote.
//
// Input:  GET /api/reviews?imdbId=tt...
// Output: { reviews: Array<{ author: string, rating: number|null, content: string, url: string }> }

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { imdbId } = req.query ?? {};
    if (typeof imdbId !== 'string' || !/^tt\d+$/.test(imdbId)) {
        res.status(400).json({ error: 'Expected ?imdbId=tt<digits>' });
        return;
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
        res.status(503).json({ error: 'TMDB_API_KEY is not configured on the server' });
        return;
    }

    try {
        // TMDB's own catalogs are keyed by their own numeric id, not IMDb's - /find resolves
        // the real IMDb id (already flowing through this app's catalog data) to it, and tells
        // us whether it's a movie or a tv show so the right /reviews endpoint gets called.
        const findResponse = await fetch(
            `${TMDB_API_BASE}/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`
        );
        if (!findResponse.ok) {
            throw new Error(`TMDB find returned ${findResponse.status}`);
        }
        const findData = await findResponse.json();
        const movie = findData.movie_results?.[0];
        const tvShow = findData.tv_results?.[0];
        const match = movie ? { id: movie.id, type: 'movie' } : tvShow ? { id: tvShow.id, type: 'tv' } : null;

        if (match === null) {
            res.status(200).json({ reviews: [] });
            return;
        }

        const reviewsResponse = await fetch(
            `${TMDB_API_BASE}/${match.type}/${match.id}/reviews?api_key=${apiKey}`
        );
        if (!reviewsResponse.ok) {
            throw new Error(`TMDB reviews returned ${reviewsResponse.status}`);
        }
        const reviewsData = await reviewsResponse.json();

        const reviews = (Array.isArray(reviewsData.results) ? reviewsData.results : [])
            .filter((review) => typeof review.content === 'string' && review.content.trim().length > 0)
            .slice(0, 6)
            .map((review) => ({
                author: typeof review.author === 'string' && review.author.length > 0 ? review.author : 'Anonymous',
                // TMDB's own 0-10 author rating, converted to the app's 5-star display -
                // frequently absent (reviewers can skip rating), left null rather than guessed.
                rating: typeof review.author_details?.rating === 'number' ? review.author_details.rating / 2 : null,
                content: review.content.trim(),
                url: typeof review.url === 'string' ? review.url : null
            }));

        res.status(200).json({ reviews });
    } catch (error) {
        console.error('Failed to fetch TMDB reviews', error);
        res.status(502).json({ error: 'Failed to fetch reviews' });
    }
};
