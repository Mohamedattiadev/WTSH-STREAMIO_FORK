// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { default: Icon } = require('stremio/components/Icon');
const { default: Button } = require('stremio/components/Button');
const { default: Image } = require('stremio/components/Image');
const ModalDialog = require('stremio/components/ModalDialog');
const styles = require('./styles');

// Matches the mockup's own trailer-modal design (a static click-to-play thumbnail - poster/
// backdrop, a center play ring, a "Play Trailer" caption over it - with title/genre-tags/
// description and a Watch Now / Library / Not Now action row below) rather than autoplaying
// immediately. Clicking the play ring swaps in the real YouTube embed - Cinemeta's
// trailerStreams always carry a real video id directly (confirmed live against the actual API
// response, not assumed), so this is still real playable video once started, just with the
// mockup's own click-to-start affordance in front of it instead of surprising the user with
// instant autoplay.
const TrailerModal = ({ name, trailerStreams, links, description, runtime, poster, background, deepLinks, inLibrary, toggleInLibrary, onCloseRequest }) => {
    const [playing, setPlaying] = React.useState(false);
    const ytId = Array.isArray(trailerStreams) && trailerStreams.length > 0 && typeof trailerStreams[0].ytId === 'string' ?
        trailerStreams[0].ytId
        :
        null;
    const genres = React.useMemo(() => {
        return Array.isArray(links) ?
            links
                .filter((link) => link && typeof link.category === 'string' && link.category.toLowerCase() === 'genres' && typeof link.name === 'string')
                .map((link) => link.name)
                .slice(0, 3)
            :
            [];
    }, [links]);
    // Same real deep-link priority MetaPreview's own "Show"/"Resume" button already uses -
    // a saved playback position first, otherwise wherever the real stream/episode picker lives.
    const showHref = React.useMemo(() => {
        return deepLinks ?
            typeof deepLinks.player === 'string' ?
                deepLinks.player
                :
                typeof deepLinks.metaDetailsStreams === 'string' ?
                    deepLinks.metaDetailsStreams
                    :
                    typeof deepLinks.metaDetailsVideos === 'string' ?
                        deepLinks.metaDetailsVideos
                        :
                        null
            :
            null;
    }, [deepLinks]);
    const onPlayClick = React.useCallback(() => {
        setPlaying(true);
    }, []);

    if (ytId === null) {
        return null;
    }

    return (
        <ModalDialog className={styles['trailer-modal']} onCloseRequest={onCloseRequest}>
            <div className={styles['video-container']}>
                {
                    playing ?
                        <iframe
                            className={styles['video']}
                            // controls=0/modestbranding=1/rel=0/iv_load_policy=3/disablekb=1 strip
                            // YouTube's own scrubber, CC/settings buttons, and "More videos"/logo
                            // overlay - they visibly clash with the app's own close button and
                            // card chrome.
                            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`}
                            title={typeof name === 'string' ? name : 'Trailer'}
                            frameBorder={'0'}
                            allow={'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'}
                            allowFullScreen
                        />
                        :
                        <Button className={styles['thumbnail']} onClick={onPlayClick}>
                            {
                                typeof (poster ?? background) === 'string' ?
                                    <Image className={styles['thumbnail-image']} src={poster ?? background} alt={' '} />
                                    :
                                    null
                            }
                            <div className={styles['thumbnail-scrim']} />
                            <div className={styles['play-ring']}>
                                <Icon className={styles['play-icon']} name={'play'} />
                            </div>
                            <div className={styles['play-caption']}>{'Play Trailer'}</div>
                        </Button>
                }
            </div>
            <div className={styles['info-container']}>
                {
                    typeof name === 'string' && name.length > 0 ?
                        <div className={styles['title']}>{name}</div>
                        :
                        null
                }
                {
                    genres.length > 0 || typeof runtime === 'string' ?
                        <div className={styles['tag-row']}>
                            {genres.map((genre) => (
                                <span key={genre} className={styles['tag']}>{genre}</span>
                            ))}
                            {
                                typeof runtime === 'string' && runtime.length > 0 ?
                                    <span className={styles['tag']}>{runtime}</span>
                                    :
                                    null
                            }
                        </div>
                        :
                        null
                }
                {
                    typeof description === 'string' && description.length > 0 ?
                        <p className={styles['description']}>{description}</p>
                        :
                        null
                }
                <div className={styles['actions-row']}>
                    {
                        typeof showHref === 'string' ?
                            <Button className={styles['watch-now-button']} href={showHref}>
                                <Icon className={styles['icon']} name={'play'} />
                                <div className={styles['label']}>{'Watch Now'}</div>
                            </Button>
                            :
                            null
                    }
                    {
                        typeof toggleInLibrary === 'function' ?
                            <Button className={styles['ghost-button']} onClick={toggleInLibrary}>
                                <Icon className={styles['icon']} name={inLibrary ? 'checkmark' : 'add'} />
                                <div className={styles['label']}>{inLibrary ? 'In Library' : 'Library'}</div>
                            </Button>
                            :
                            null
                    }
                    <Button className={styles['ghost-button']} onClick={onCloseRequest}>
                        <div className={styles['label']}>{'Not Now'}</div>
                    </Button>
                </div>
            </div>
        </ModalDialog>
    );
};

TrailerModal.propTypes = {
    name: PropTypes.string,
    trailerStreams: PropTypes.array,
    links: PropTypes.array,
    description: PropTypes.string,
    runtime: PropTypes.string,
    poster: PropTypes.string,
    background: PropTypes.string,
    deepLinks: PropTypes.shape({
        player: PropTypes.string,
        metaDetailsVideos: PropTypes.string,
        metaDetailsStreams: PropTypes.string,
    }),
    inLibrary: PropTypes.bool,
    toggleInLibrary: PropTypes.func,
    onCloseRequest: PropTypes.func
};

module.exports = TrailerModal;
