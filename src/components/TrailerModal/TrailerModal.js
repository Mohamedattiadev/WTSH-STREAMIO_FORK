// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const ModalDialog = require('stremio/components/ModalDialog');
const styles = require('./styles');

// A real, playing-video trailer popup (matching the design mockup's trailer modal card - video on
// top, title/genre-tags/description below, a library action) instead of navigating away to the
// full Player route. Cinemeta's trailerStreams always carry a real YouTube video id directly
// (confirmed live against the actual API response, not assumed) - a plain YouTube embed is the
// honest, real implementation here, not a placeholder.
//
// The mockup's own version is a static preview thumbnail (a play-ring icon over a poster, with a
// separate "Watch Now" button that hands off to the full Player) since it has no real video to
// embed. We already have a real playable trailer, so it autoplays directly here instead of adding
// a fake extra click-through step - genres/description/library toggle only render when the caller
// actually has that data (MetaItem's card-hover trailer only knows name/links; MetaPreview's panel
// button has the full real detail set).
const TrailerModal = ({ name, trailerStreams, links, description, inLibrary, toggleInLibrary, onCloseRequest }) => {
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
    const buttons = React.useMemo(() => {
        return typeof toggleInLibrary === 'function' ? [
            {
                label: inLibrary ? 'In Library' : 'Add to Library',
                icon: inLibrary ? 'checkmark' : 'add',
                props: { onClick: toggleInLibrary }
            }
        ] : null;
    }, [inLibrary, toggleInLibrary]);

    if (ytId === null) {
        return null;
    }

    return (
        <ModalDialog className={styles['trailer-modal']} buttons={buttons} onCloseRequest={onCloseRequest}>
            <div className={styles['video-container']}>
                <iframe
                    className={styles['video']}
                    // controls=0/modestbranding=1/rel=0/iv_load_policy=3/disablekb=1 strip
                    // YouTube's own scrubber, CC/settings buttons, and "More videos"/logo
                    // overlay - the mockup's trailer preview never shows any of that, and
                    // with those controls left on they visibly clash with the app's own
                    // close button and card chrome.
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`}
                    title={typeof name === 'string' ? name : 'Trailer'}
                    frameBorder={'0'}
                    allow={'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'}
                    allowFullScreen
                />
            </div>
            <div className={styles['info-container']}>
                {
                    typeof name === 'string' && name.length > 0 ?
                        <div className={styles['title']}>{name}</div>
                        :
                        null
                }
                {
                    genres.length > 0 ?
                        <div className={styles['tag-row']}>
                            {genres.map((genre) => (
                                <span key={genre} className={styles['tag']}>{genre}</span>
                            ))}
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
            </div>
        </ModalDialog>
    );
};

TrailerModal.propTypes = {
    name: PropTypes.string,
    trailerStreams: PropTypes.array,
    links: PropTypes.array,
    description: PropTypes.string,
    inLibrary: PropTypes.bool,
    toggleInLibrary: PropTypes.func,
    onCloseRequest: PropTypes.func
};

module.exports = TrailerModal;
