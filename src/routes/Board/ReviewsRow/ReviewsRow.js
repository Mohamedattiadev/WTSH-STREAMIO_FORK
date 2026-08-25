// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button } = require('stremio/components');
const useReviews = require('./useReviews');
const styles = require('./styles');

const IMDB_ID_PATTERN = /^tt\d+$/;
const SCROLL_AMOUNT = 320;
// Below this, every review already fits in view (or close enough) with no scrolling needed at
// all - auto-advancing a row nobody has to scroll would just be motion for its own sake, moving
// content out from under someone mid-read for no reason.
const AUTO_SLIDE_MIN_REVIEWS = 6;
const AUTO_SLIDE_INTERVAL = 4500;

// "What people are saying" - the hero's mockup counterpart, but backed by real TMDB reviews
// (see api/reviews.js) instead of the mockup's fabricated quotes. Renders nothing at all when
// there's no real imdb id to look up, or the title genuinely has no reviews on TMDB - no
// placeholder, no "no reviews yet" filler, just absent, same as every other real-data-only
// section in this app.
const ReviewsRow = ({ className, item }) => {
    const imdbId = typeof item?.id === 'string' && IMDB_ID_PATTERN.test(item.id) ? item.id : null;
    const reviews = useReviews(imdbId);
    const scrollRef = React.useRef(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(false);

    const updateScrollState = React.useCallback(() => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    React.useEffect(() => {
        updateScrollState();
    }, [reviews, updateScrollState]);

    const onScrollLeftClick = React.useCallback(() => {
        scrollRef.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
    }, []);

    const onScrollRightClick = React.useCallback(() => {
        scrollRef.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
    }, []);

    const [autoSlidePaused, setAutoSlidePaused] = React.useState(false);
    const pauseAutoSlide = React.useCallback(() => setAutoSlidePaused(true), []);
    const resumeAutoSlide = React.useCallback(() => setAutoSlidePaused(false), []);

    // Loops back to the start instead of stopping at the last card - with real TMDB review
    // counts running well past what fits on screen, a one-shot scroll-to-the-end would just
    // leave the row stuck there for anyone who steps away for a minute, never showing the first
    // few reviews again.
    React.useEffect(() => {
        if (reviews.length <= AUTO_SLIDE_MIN_REVIEWS || autoSlidePaused) {
            return;
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const interval = setInterval(() => {
            const el = scrollRef.current;
            if (!el) {
                return;
            }
            if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
                el.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                el.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
            }
        }, AUTO_SLIDE_INTERVAL);

        return () => {
            clearInterval(interval);
        };
    }, [reviews.length, autoSlidePaused]);

    if (reviews.length === 0) {
        return null;
    }

    return (
        <div className={classnames(className, styles['row'])}>
            <div className={styles['row-head']}>
                <h3 className={styles['row-title']}>{'What people are saying'}</h3>
            </div>
            <div className={styles['review-row-container']}>
                <div
                    ref={scrollRef}
                    className={styles['review-row']}
                    onScroll={updateScrollState}
                    onMouseEnter={pauseAutoSlide}
                    onMouseLeave={resumeAutoSlide}
                    onFocus={pauseAutoSlide}
                    onBlur={resumeAutoSlide}
                >
                    {reviews.map((review, index) => (
                        <div key={index} className={styles['review-card']}>
                            {
                                review.rating !== null ?
                                    <div className={styles['review-stars']}>
                                        {'★'.repeat(Math.round(review.rating))}
                                        {'☆'.repeat(Math.max(5 - Math.round(review.rating), 0))}
                                    </div>
                                    :
                                    null
                            }
                            <p className={styles['review-content']}>{review.content}</p>
                            <div className={styles['review-source']}>{`— ${review.author} via TMDB`}</div>
                        </div>
                    ))}
                </div>
                {
                    canScrollLeft ?
                        <Button className={classnames(styles['nav-arrow'], styles['nav-arrow-prev'])} title={'Previous'} onClick={onScrollLeftClick}>
                            <Icon className={styles['icon']} name={'chevron-back'} />
                        </Button>
                        :
                        null
                }
                {
                    canScrollRight ?
                        <Button className={classnames(styles['nav-arrow'], styles['nav-arrow-next'])} title={'Next'} onClick={onScrollRightClick}>
                            <Icon className={styles['icon']} name={'chevron-forward'} />
                        </Button>
                        :
                        null
                }
            </div>
        </div>
    );
};

ReviewsRow.propTypes = {
    className: PropTypes.string,
    item: PropTypes.shape({
        id: PropTypes.string
    })
};

module.exports = ReviewsRow;
