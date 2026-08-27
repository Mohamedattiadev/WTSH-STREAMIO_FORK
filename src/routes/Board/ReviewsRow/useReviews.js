// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');

// Fetches real TMDB reviews for a title via the server-side proxy at api/reviews.js (the only
// place TMDB_API_KEY is read - see that file). Never returns anything but what TMDB actually
// has; an unrecognized/missing imdbId or a title with no reviews both resolve to [].
const useReviews = (imdbId) => {
    const [reviews, setReviews] = React.useState([]);

    React.useEffect(() => {
        if (typeof imdbId !== 'string' || imdbId.length === 0) {
            setReviews([]);
            return undefined;
        }

        let cancelled = false;
        fetch(`/api/reviews?imdbId=${encodeURIComponent(imdbId)}`)
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('bad response')))
            .then((data) => {
                if (!cancelled) {
                    setReviews(Array.isArray(data.reviews) ? data.reviews : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setReviews([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [imdbId]);

    return reviews;
};

module.exports = useReviews;
