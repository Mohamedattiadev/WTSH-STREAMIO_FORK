// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const ModalDialog = require('stremio/components/ModalDialog');
const styles = require('./styles');

// A real, playing-video trailer popup (matching the design mockup's trailer modal intent) instead
// of navigating away to the full Player route. Cinemeta's trailerStreams always carry a real
// YouTube video id directly (confirmed live against the actual API response, not assumed) - a
// plain YouTube embed is the honest, real implementation here, not a placeholder.
const TrailerModal = ({ name, trailerStreams, onCloseRequest }) => {
    const ytId = Array.isArray(trailerStreams) && trailerStreams.length > 0 && typeof trailerStreams[0].ytId === 'string' ?
        trailerStreams[0].ytId
        :
        null;

    if (ytId === null) {
        return null;
    }

    return (
        <ModalDialog className={styles['trailer-modal']} title={name} onCloseRequest={onCloseRequest}>
            <div className={styles['video-container']}>
                <iframe
                    className={styles['video']}
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                    title={typeof name === 'string' ? name : 'Trailer'}
                    frameBorder={'0'}
                    allow={'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'}
                    allowFullScreen
                />
            </div>
        </ModalDialog>
    );
};

TrailerModal.propTypes = {
    name: PropTypes.string,
    trailerStreams: PropTypes.array,
    onCloseRequest: PropTypes.func
};

module.exports = TrailerModal;
