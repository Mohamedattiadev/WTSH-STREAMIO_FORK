// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button, Image } = require('stremio/components');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const TrailerModal = require('stremio/components/TrailerModal');
const useBinaryState = require('stremio/common/useBinaryState');
const styles = require('./styles');

const AUTOPLAY_INTERVAL_MS = 7000;

const extractGenres = (item) => {
    return Array.isArray(item.links) ?
        item.links
            .filter((link) => typeof link.category === 'string' && link.category.toLowerCase() === 'genres' && typeof link.name === 'string')
            .map((link) => link.name)
        :
        [];
};

const extractYear = (releaseInfo) => {
    if (typeof releaseInfo !== 'string') {
        return null;
    }

    const match = releaseInfo.match(/\d{4}/);
    return match ? match[0] : null;
};

const HeroSlide = React.memo(({ item, resumable, active }) => {
    const [trailerModalOpen, openTrailerModal, closeTrailerModal] = useBinaryState(false);
    const playerHref = resumable && item.deepLinks && typeof item.deepLinks.player === 'string' ? item.deepLinks.player : null;
    const detailsHref = React.useMemo(() => getMetaDetailsHref(item.deepLinks), [item.deepLinks]);
    const hasTrailer = Array.isArray(item.trailerStreams) && item.trailerStreams.length > 0 && typeof item.trailerStreams[0].ytId === 'string';
    const onTrailerClick = React.useCallback((event) => {
        event.preventDefault();
        openTrailerModal();
    }, [openTrailerModal]);
    const renderBackdropFallback = React.useCallback(() => null, []);
    const renderTitleFallback = React.useCallback(() => (
        <div className={styles['title']}>{item.name}</div>
    ), [item.name]);
    const genres = React.useMemo(() => extractGenres(item).slice(0, 3), [item]);
    const year = React.useMemo(() => extractYear(item.releaseInfo), [item.releaseInfo]);
    return (
        <div className={classnames(styles['hero-slide'], { [styles['active']]: active })} aria-hidden={!active}>
            <div className={styles['backdrop-layer']}>
                <Image className={styles['backdrop-image']} src={item.background ?? item.poster} alt={' '} renderFallback={renderBackdropFallback} />
                <div className={styles['backdrop-gradient']} />
                <div className={styles['backdrop-vignette']} />
            </div>
            <div className={styles['info-container']}>
                {
                    resumable ?
                        <div className={styles['eyebrow']}>Continue Watching</div>
                        :
                        typeof item.type === 'string' && item.type.length > 0 ?
                            <div className={styles['eyebrow']}>
                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                {year !== null ? ` · ${year}` : ''}
                            </div>
                            :
                            null
                }
                {
                    typeof item.logo === 'string' && item.logo.length > 0 ?
                        <Image className={styles['logo']} src={item.logo} alt={item.name} renderFallback={renderTitleFallback} />
                        :
                        renderTitleFallback()
                }
                {
                    year !== null || typeof item.runtime === 'string' || genres.length > 0 ?
                        <div className={styles['meta-row']}>
                            {
                                [
                                    year,
                                    typeof item.runtime === 'string' && item.runtime.length > 0 ? item.runtime : null,
                                    ...genres
                                ]
                                    .filter((value) => value !== null)
                                    .map((value, index) => (
                                        <React.Fragment key={value}>
                                            {index > 0 ? <span className={styles['meta-dot']} /> : null}
                                            <span>{value}</span>
                                        </React.Fragment>
                                    ))
                            }
                        </div>
                        :
                        null
                }
                {
                    typeof item.description === 'string' && item.description.length > 0 ?
                        <div className={styles['description']}>{item.description}</div>
                        :
                        null
                }
                {
                    typeof item.progress === 'number' && item.progress > 0 ?
                        <div className={styles['progress-bar-container']}>
                            <div className={styles['progress-bar']} style={{ width: `${item.progress}%` }} />
                        </div>
                        :
                        null
                }
                <div className={styles['buttons-container']}>
                    <Button className={styles['primary-button']} href={playerHref ?? detailsHref ?? undefined} tabIndex={active ? 0 : -1}>
                        <Icon className={styles['icon']} name={'play'} />
                        <div className={styles['label']}>{playerHref ? 'Resume' : 'Show'}</div>
                    </Button>
                    {
                        hasTrailer ?
                            <Button className={styles['secondary-button']} onClick={onTrailerClick} tabIndex={active ? 0 : -1}>
                                <Icon className={styles['icon']} name={'trailer'} />
                                <div className={styles['label']}>Trailer</div>
                            </Button>
                            :
                            detailsHref ?
                                <Button className={styles['secondary-button']} href={detailsHref} tabIndex={active ? 0 : -1}>
                                    <Icon className={styles['icon']} name={'about'} />
                                    <div className={styles['label']}>Details</div>
                                </Button>
                                :
                                null
                    }
                </div>
            </div>
            {
                trailerModalOpen ?
                    <TrailerModal
                        name={item.name}
                        trailerStreams={item.trailerStreams}
                        links={item.links}
                        description={item.description}
                        runtime={item.runtime}
                        poster={item.poster}
                        background={item.background}
                        deepLinks={item.deepLinks}
                        onCloseRequest={closeTrailerModal}
                    />
                    :
                    null
            }
        </div>
    );
});

HeroSlide.displayName = 'HeroSlide';

HeroSlide.propTypes = {
    item: PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        logo: PropTypes.string,
        poster: PropTypes.string,
        background: PropTypes.string,
        description: PropTypes.string,
        progress: PropTypes.number,
        releaseInfo: PropTypes.string,
        runtime: PropTypes.string,
        links: PropTypes.array,
        deepLinks: PropTypes.shape({
            player: PropTypes.string,
            metaDetailsVideos: PropTypes.string,
            metaDetailsStreams: PropTypes.string,
        }),
    }).isRequired,
    resumable: PropTypes.bool,
    active: PropTypes.bool,
};

const Hero = ({ items, onActiveItemChange }) => {
    const [index, setIndex] = React.useState(0);
    const [paused, setPaused] = React.useState(false);

    React.useEffect(() => {
        if (index >= items.length) {
            setIndex(0);
        }
    }, [items.length, index]);

    React.useEffect(() => {
        if (typeof onActiveItemChange === 'function') {
            onActiveItemChange(items[index]?.item ?? null);
        }
    }, [items, index, onActiveItemChange]);

    const goTo = React.useCallback((nextIndex) => {
        if (items.length === 0) {
            return;
        }

        setIndex(((nextIndex % items.length) + items.length) % items.length);
    }, [items.length]);

    const goToNext = React.useCallback(() => {
        goTo(index + 1);
    }, [goTo, index]);

    const goToPrev = React.useCallback(() => {
        goTo(index - 1);
    }, [goTo, index]);

    React.useEffect(() => {
        if (paused || items.length <= 1) {
            return undefined;
        }

        const timeoutId = setTimeout(() => {
            goTo(index + 1);
        }, AUTOPLAY_INTERVAL_MS);
        return () => clearTimeout(timeoutId);
    }, [index, paused, items.length, goTo]);

    const onMouseEnter = React.useCallback(() => setPaused(true), []);
    const onMouseLeave = React.useCallback(() => setPaused(false), []);
    const onFocus = React.useCallback(() => setPaused(true), []);
    const onBlur = React.useCallback((event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setPaused(false);
        }
    }, []);
    const onKeyDown = React.useCallback((event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            goToPrev();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            goToNext();
        }
    }, [goToPrev, goToNext]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div
            className={styles['hero-container']}
            role={'region'}
            aria-roledescription={'carousel'}
            aria-label={'Featured'}
            tabIndex={0}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
        >
            {items.map(({ item, resumable }, itemIndex) => (
                <HeroSlide key={item.id ?? itemIndex} item={item} resumable={resumable} active={itemIndex === index} />
            ))}
            {
                items.length > 1 ?
                    <React.Fragment>
                        <Button className={classnames(styles['nav-arrow'], styles['nav-arrow-prev'])} title={'Previous'} onClick={goToPrev}>
                            <Icon className={styles['icon']} name={'chevron-back'} />
                        </Button>
                        <Button className={classnames(styles['nav-arrow'], styles['nav-arrow-next'])} title={'Next'} onClick={goToNext}>
                            <Icon className={styles['icon']} name={'chevron-forward'} />
                        </Button>
                        <div className={styles['dots-container']}>
                            {items.map(({ item }, dotIndex) => (
                                <Button
                                    key={item.id ?? dotIndex}
                                    className={classnames(styles['dot'], { [styles['active']]: dotIndex === index })}
                                    title={item.name}
                                    aria-current={dotIndex === index}
                                    onClick={() => goTo(dotIndex)}
                                />
                            ))}
                        </div>
                    </React.Fragment>
                    :
                    null
            }
        </div>
    );
};

Hero.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        item: PropTypes.object.isRequired,
        resumable: PropTypes.bool,
    })).isRequired,
    onActiveItemChange: PropTypes.func,
};

module.exports = Hero;
