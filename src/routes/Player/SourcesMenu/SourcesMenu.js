// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const Stream = require('stremio/routes/MetaDetails/StreamsList/Stream');
const styles = require('./styles');

// Lets the user manually jump to a different source for the video already playing, in case the
// current one stalls or plays back badly without ever firing the hard failure Player.js's own
// auto-fallback effect listens for. Reuses the same Stream row component and streams data
// MetaDetails' own StreamsList already renders, just laid out as a compact in-player menu
// instead of a full page list.
const SourcesMenu = React.forwardRef(({ className, streams = [], loading = false, videoId, selectedStreamLink, onStreamSelected }, ref) => {
    const onMouseDown = React.useCallback((event) => {
        event.nativeEvent.sourcesMenuClosePrevented = true;
    }, []);

    return (
        <div ref={ref} className={classnames(className, styles['sources-menu'])} onMouseDown={onMouseDown}>
            <div className={styles['container']}>
                <div className={styles['header']}>{'Switch Source'}</div>
                <div className={styles['list']}>
                    {
                        streams.map((stream, index) => (
                            <Stream
                                key={stream.deepLinks?.player ?? index}
                                className={classnames(styles['stream'], { 'selected': stream.deepLinks?.player === selectedStreamLink })}
                                videoId={videoId}
                                addonName={stream.addonName}
                                name={stream.name}
                                description={stream.description}
                                thumbnail={stream.thumbnail}
                                deepLinks={stream.deepLinks}
                                onClick={onStreamSelected}
                            />
                        ))
                    }
                    {
                        loading ?
                            <div className={styles['status']}>{'Loading other sources...'}</div>
                            :
                            streams.length === 0 ?
                                <div className={styles['status']}>{'No other sources found.'}</div>
                                :
                                null
                    }
                </div>
            </div>
        </div>
    );
});

SourcesMenu.displayName = 'SourcesMenu';

SourcesMenu.propTypes = {
    className: PropTypes.string,
    streams: PropTypes.array,
    loading: PropTypes.bool,
    videoId: PropTypes.string,
    selectedStreamLink: PropTypes.string,
    onStreamSelected: PropTypes.func,
};

module.exports = SourcesMenu;
