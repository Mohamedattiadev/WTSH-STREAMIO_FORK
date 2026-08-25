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

    if (reviews.length === 0) {
        return null;
    }

    return (
        <div className={classnames(className, styles['row'])}>
            <div className={styles['row-head']}>
                <h3 className={styles['row-title']}>{'What people are saying'}</h3>
            </div>
            <div className={styles['review-row-container']}>
                <div ref={scrollRef} className={styles['review-row']} onScroll={updateScrollState}>
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
