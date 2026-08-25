// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const filterInvalidDOMProps = require('filter-invalid-dom-props').default;
const { default: Icon } = require('stremio/components/Icon');
const { default: Button } = require('stremio/components/Button');
const { default: Image } = require('stremio/components/Image');
const Multiselect = require('stremio/components/Multiselect');
const TrailerModal = require('stremio/components/TrailerModal');
const { default: AddToCalendarButton } = require('stremio/components/AddToCalendarButton');
const useBinaryState = require('stremio/common/useBinaryState');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const CONSTANTS = require('stremio/common/CONSTANTS');
const { ICON_FOR_TYPE } = CONSTANTS;
const styles = require('./styles');

const MetaItem = React.memo(({ className, type, name, poster, posterShape, posterChangeCursor, progress, newVideos, options, deepLinks, links, trailerStreams, releaseInfo, href: customHref, dataset, optionOnSelect, onDismissClick, onPlayClick, watched, badgeLabel, ...props }) => {
    const { t } = useTranslation();
    const [menuOpen, onMenuOpen, onMenuClose] = useBinaryState(false);
    const [trailerModalOpen, openTrailerModal, closeTrailerModal] = useBinaryState(false);
    // Same real IMDb-link convention MetaPreview reads its rating badge from (the link's
    // `name` carries the rating value, e.g. "7.9") - no separate `imdbRating` field exists
    // on MetaItemPreview, so this is the only real (non-fabricated) source for a card rating.
    const rating = React.useMemo(() => {
        const imdbLink = Array.isArray(links) ?
            links.find((link) => link && link.category === CONSTANTS.IMDB_LINK_CATEGORY)
            :
            null;
        return imdbLink && typeof imdbLink.name === 'string' && imdbLink.name.length > 0 ? imdbLink.name : null;
    }, [links]);
    const subtitle = React.useMemo(() => {
        const typeLabel = typeof type === 'string' && type.length > 0 ? type.charAt(0).toUpperCase() + type.slice(1) : null;
        if (typeLabel === null) {
            return typeof releaseInfo === 'string' && releaseInfo.length > 0 ? releaseInfo : null;
        }

        return typeof releaseInfo === 'string' && releaseInfo.length > 0 ? `${typeLabel} · ${releaseInfo}` : typeLabel;
    }, [type, releaseInfo]);
    const trailerHref = React.useMemo(() => {
        if (onPlayClick || !Array.isArray(trailerStreams) || trailerStreams.length === 0) {
            return null;
        }

        const [trailerStream] = trailerStreams;
        return trailerStream?.deepLinks?.player ?? null;
    }, [onPlayClick, trailerStreams]);
    const trailerOnClick = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof trailerHref === 'string') {
            openTrailerModal();
        }
    }, [trailerHref, openTrailerModal]);
    const href = React.useMemo(() => {
        return typeof customHref === 'string' ? customHref : getMetaDetailsHref(deepLinks);
    }, [customHref, deepLinks]);
    const metaItemOnClick = React.useCallback((event) => {
        if (event.nativeEvent.selectPrevented) {
            event.preventDefault();
        } else if (typeof props.onClick === 'function') {
            props.onClick(event);
        }
    }, [props.onClick]);
    const menuOnClick = React.useCallback((event) => {
        event.nativeEvent.selectPrevented = true;
    }, []);
    const dismissOnClick = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismissClick(event);
    }, [onDismissClick]);
    const playOnClick = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        onPlayClick(event);
    }, [onPlayClick]);
    const menuOnSelect = React.useCallback((event) => {
        if (typeof optionOnSelect === 'function') {
            optionOnSelect({
                type: 'select-option',
                value: event.value,
                dataset: dataset,
                reactEvent: event.reactEvent,
                nativeEvent: event.nativeEvent
            });
        }
    }, [dataset, optionOnSelect]);
    const renderPosterFallback = React.useCallback(() => (
        <Icon
            className={styles['placeholder-icon']}
            name={ICON_FOR_TYPE.has(type) ? ICON_FOR_TYPE.get(type) : ICON_FOR_TYPE.get('other')}
        />
    ), [type]);
    const renderMenuLabelContent = React.useCallback(() => (
        <Icon className={styles['icon']} name={'more-vertical'} />
    ), []);
    return (
        <Button title={name} href={href} {...filterInvalidDOMProps(props)} className={classnames(className, styles['meta-item-container'], styles['poster-shape-poster'], styles[`poster-shape-${posterShape}`], { 'active': menuOpen })} onClick={metaItemOnClick}>
            <div className={classnames(styles['poster-container'], { 'poster-change-cursor': posterChangeCursor })}>
                {
                    typeof badgeLabel === 'string' && badgeLabel.length > 0 ?
                        <div className={styles['source-badge-layer']}>
                            <div className={styles['source-badge-label']}>{badgeLabel}</div>
                        </div>
                        :
                        null
                }
                <div className={styles['poster-image-layer']}>
                    <Image
                        className={styles['poster-image']}
                        src={poster}
                        alt={' '}
                        renderFallback={renderPosterFallback}
                    />
                </div>
                <div className={styles['poster-scrim']} />
                {
                    onPlayClick ?
                        <div title={t('CONTINUE_WATCHING')} className={styles['play-icon-layer']} onClick={playOnClick}>
                            <Icon className={styles['play-icon']} name={'play'} />
                        </div>
                        :
                        typeof trailerHref === 'string' ?
                            <div title={'Trailer'} className={styles['poster-trailer']} onClick={trailerOnClick}>
                                <Icon className={styles['icon']} name={'play'} />
                                <span>Trailer</span>
                            </div>
                            :
                            null
                }
                {
                    onDismissClick || (Array.isArray(options) && options.length > 0) || (typeof name === 'string' && name.length > 0) ?
                        <div className={styles['poster-actions']}>
                            {
                                typeof name === 'string' && name.length > 0 ?
                                    <AddToCalendarButton
                                        size={'sm'}
                                        title={name}
                                        poster={poster}
                                    />
                                    :
                                    null
                            }
                            {
                                onDismissClick ?
                                    <div title={t('LIBRARY_RESUME_DISMISS')} className={classnames(styles['action-btn'], styles['danger'])} onClick={dismissOnClick}>
                                        <Icon className={styles['icon']} name={'close'} />
                                    </div>
                                    :
                                    null
                            }
                            {
                                Array.isArray(options) && options.length > 0 ?
                                    <Multiselect
                                        className={styles['action-btn']}
                                        renderLabelContent={renderMenuLabelContent}
                                        options={options}
                                        onOpen={onMenuOpen}
                                        onClose={onMenuClose}
                                        onSelect={menuOnSelect}
                                        tabIndex={-1}
                                        onClick={menuOnClick}
                                    />
                                    :
                                    null
                            }
                        </div>
                        :
                        null
                }
                {
                    watched ?
                        <div className={styles['watched-icon-layer']}>
                            <Icon className={styles['watched-icon']} name={'checkmark'} />
                        </div>
                        :
                        null
                }
                {
                    newVideos > 0 ?
                        <div className={styles['new-videos']}>
                            <div className={styles['layer']} />
                            <div className={styles['layer']} />
                            <div className={styles['layer']}>
                                <Icon className={styles['icon']} name={'add'} />
                                <div className={styles['label']}>
                                    {newVideos}
                                </div>
                            </div>
                        </div>
                        :
                        null
                }
                {
                    typeof name === 'string' && name.length > 0 ?
                        <div className={styles['title-label']}>{name}</div>
                        :
                        null
                }
                {
                    progress > 0 ?
                        <div className={styles['progress-bar-layer']}>
                            <div className={styles['progress-bar']} style={{ width: `${progress}%` }} />
                        </div>
                        :
                        null
                }
            </div>
            {
                (typeof name === 'string' && name.length > 0) || subtitle !== null ?
                    <div className={styles['card-info']}>
                        {
                            typeof name === 'string' && name.length > 0 ?
                                <div className={styles['card-title']}>{name}</div>
                                :
                                null
                        }
                        {
                            subtitle !== null ?
                                <div className={styles['card-sub']}>{subtitle}</div>
                                :
                                null
                        }
                        {
                            rating !== null ?
                                <div className={styles['card-rating']}>
                                    <Icon className={styles['icon']} name={'star'} />
                                    <span>{rating}</span>
                                </div>
                                :
                                null
                        }
                    </div>
                    :
                    null
            }
            {
                trailerModalOpen ?
                    <TrailerModal name={name} trailerStreams={trailerStreams} links={links} onCloseRequest={closeTrailerModal} />
                    :
                    null
            }
        </Button>
    );
});

MetaItem.displayName = 'MetaItem';

MetaItem.propTypes = {
    className: PropTypes.string,
    type: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.string,
    posterShape: PropTypes.oneOf(['poster', 'landscape', 'square']),
    posterChangeCursor: PropTypes.bool,
    progress: PropTypes.number,
    newVideos: PropTypes.number,
    options: PropTypes.array,
    href: PropTypes.string,
    deepLinks: PropTypes.shape({
        metaDetailsVideos: PropTypes.string,
        metaDetailsStreams: PropTypes.string,
        player: PropTypes.string
    }),
    links: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        category: PropTypes.string,
        url: PropTypes.string
    })),
    trailerStreams: PropTypes.arrayOf(PropTypes.shape({
        deepLinks: PropTypes.shape({
            player: PropTypes.string
        })
    })),
    releaseInfo: PropTypes.string,
    dataset: PropTypes.object,
    optionOnSelect: PropTypes.func,
    onDismissClick: PropTypes.func,
    onPlayClick: PropTypes.func,
    onClick: PropTypes.func,
    watched: PropTypes.bool,
    badgeLabel: PropTypes.string
};

module.exports = MetaItem;
