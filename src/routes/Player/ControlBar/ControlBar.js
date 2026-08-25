// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button, ChatIcon } = require('stremio/components');
const { useServices } = require('stremio/services');
const SeekBar = require('./SeekBar');
const VolumeSlider = require('./VolumeSlider');
const styles = require('./styles');
const { useBinaryState, usePlatform } = require('stremio/common');
const { t } = require('i18next');

const ControlBar = React.forwardRef(({
    className,
    paused,
    time,
    duration,
    buffered,
    volume,
    muted,
    playbackSpeed,
    subtitlesTracks,
    audioTracks,
    metaItem,
    nextVideo,
    stream,
    statisticsAvailable,
    onPlayRequested,
    onPauseRequested,
    onNextVideoRequested,
    onMuteRequested,
    onUnmuteRequested,
    onVolumeChangeRequested,
    onSeekRequested,
    onSeekPrev,
    onSeekNext,
    seekTimeDuration,
    onToggleSubtitlesMenu,
    onToggleAudioMenu,
    onToggleSpeedMenu,
    onToggleSideDrawer,
    onToggleSearchPanel,
    onToggleChatPanel,
    onToggleOptionsMenu,
    shellCastSupported,
    onToggleCastDevicesMenu,
    videoScale,
    videoScaleLabel,
    onVideoScaleChanged,
    onToggleStatisticsMenu,
    onTouchEnd,
    ...props
}, ref) => {
    const { chromecast } = useServices();
    const platform = usePlatform();
    const [chromecastServiceActive, setChromecastServiceActive] = React.useState(() => chromecast.active);
    const [buttonsMenuOpen, , , toggleButtonsMenu] = useBinaryState(false);
    const onSubtitlesButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.subtitlesMenuClosePrevented = true;
    }, []);
    const onAudioButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.audioMenuClosePrevented = true;
    }, []);
    const onSpeedButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.speedMenuClosePrevented = true;
    }, []);
    const onVideosButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.videosMenuClosePrevented = true;
    }, []);
    const onSearchButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.searchPanelClosePrevented = true;
    }, []);
    const onChatButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.chatPanelClosePrevented = true;
    }, []);
    const onOptionsButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.optionsMenuClosePrevented = true;
    }, []);
    const onStatisticsButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.statisticsMenuClosePrevented = true;
    }, []);
    const onCastDevicesButtonMouseDown = React.useCallback((event) => {
        event.nativeEvent.castDevicesMenuClosePrevented = true;
    }, []);
    const seekSeconds = typeof seekTimeDuration === 'number' ? Math.round(seekTimeDuration / 1000) : null;
    const onSeekPrevButtonClick = React.useCallback((event) => {
        if (typeof onSeekPrev === 'function') {
            onSeekPrev(event);
        }
    }, [onSeekPrev]);
    const onSeekNextButtonClick = React.useCallback((event) => {
        if (typeof onSeekNext === 'function') {
            onSeekNext(event);
        }
    }, [onSeekNext]);
    const onPlayPauseButtonClick = React.useCallback(() => {
        if (paused) {
            if (typeof onPlayRequested === 'function') {
                onPlayRequested();
            }
        } else {
            if (typeof onPauseRequested === 'function') {
                onPauseRequested();
            }
        }
    }, [paused, onPlayRequested, onPauseRequested]);
    const onNextVideoButtonClick = React.useCallback(() => {
        if (nextVideo !== null && typeof onNextVideoRequested === 'function') {
            onNextVideoRequested();
        }
    }, [nextVideo, onNextVideoRequested]);
    const onMuteButtonClick = React.useCallback(() => {
        if (muted) {
            if (typeof onUnmuteRequested === 'function') {
                onUnmuteRequested();
            }
        } else {
            if (typeof onMuteRequested === 'function') {
                onMuteRequested();
            }
        }
    }, [muted, onMuteRequested, onUnmuteRequested]);
    const castButtonDisabled = platform.shell.active ? !shellCastSupported : !chromecastServiceActive;
    const onChromecastButtonClick = React.useCallback(() => {
        if (platform.shell.active) {
            if (shellCastSupported && typeof onToggleCastDevicesMenu === 'function') {
                onToggleCastDevicesMenu();
            }
            return;
        }
        if (castButtonDisabled) {
            return;
        }
        chromecast.transport.requestSession();
    }, [castButtonDisabled, platform.shell.active, shellCastSupported, onToggleCastDevicesMenu]);
    React.useEffect(() => {
        const onStateChanged = () => {
            setChromecastServiceActive(chromecast.active);
        };
        chromecast.on('stateChanged', onStateChanged);
        return () => {
            chromecast.off('stateChanged', onStateChanged);
        };
    }, []);
    return (
        <div ref={ref} {...props} onTouchStart={props.onMouseOver} onTouchMove={props.onMouseMove} onTouchEnd={onTouchEnd} className={classnames(className, styles['control-bar-container'])}>
            <SeekBar
                className={styles['seek-bar']}
                time={time}
                duration={duration}
                buffered={buffered}
                onSeekRequested={onSeekRequested}
                playbackSpeed={playbackSpeed}
            />
            <div className={styles['control-bar-buttons-container']}>
                {
                    typeof onSeekPrev === 'function' ?
                        <Button className={classnames(styles['control-bar-button'], styles['skip-button'])} title={t('PLAYER_SEEK_BACKWARD')} tabIndex={-1} onClick={onSeekPrevButtonClick}>
                            <Icon className={styles['icon']} name={'skip-back'} />
                            {seekSeconds !== null ? <div className={styles['skip-label']}>{seekSeconds}</div> : null}
                        </Button>
                        :
                        null
                }
                <Button className={classnames(styles['control-bar-button'], { 'disabled': typeof paused !== 'boolean' })} title={paused ? t('PLAYER_PLAY') : t('PLAYER_PAUSE')} tabIndex={-1} onClick={onPlayPauseButtonClick}>
                    <Icon className={styles['icon']} name={typeof paused !== 'boolean' || paused ? 'play' : 'pause'} />
                </Button>
                {
                    typeof onSeekNext === 'function' ?
                        <Button className={classnames(styles['control-bar-button'], styles['skip-button'])} title={t('PLAYER_SEEK_FORWARD')} tabIndex={-1} onClick={onSeekNextButtonClick}>
                            <Icon className={styles['icon']} name={'skip-forward'} />
                            {seekSeconds !== null ? <div className={styles['skip-label']}>{seekSeconds}</div> : null}
                        </Button>
                        :
                        null
                }
                {
                    nextVideo !== null ?
                        <Button className={classnames(styles['control-bar-button'])} title={t('PLAYER_NEXT_VIDEO')} tabIndex={-1} onClick={onNextVideoButtonClick}>
                            <Icon className={styles['icon']} name={'next'} />
                        </Button>
                        :
                        null
                }
                <Button className={classnames(styles['control-bar-button'], { 'disabled': typeof muted !== 'boolean' })} title={muted ? t('PLAYER_UNMUTE') : t('PLAYER_MUTE')} tabIndex={-1} onClick={onMuteButtonClick}>
                    <Icon
                        className={styles['icon']}
                        name={
                            (typeof muted === 'boolean' && muted) ? 'volume-mute' :
                                (volume === null || isNaN(volume)) ? 'volume-off' :
                                    volume === 0 ? 'volume-mute' :
                                        volume < 30 ? 'volume-low' :
                                            volume < 70 ? 'volume-medium' :
                                                'volume-high'
                        }
                    />
                </Button>
                {
                    !platform.isMobile ?
                        <VolumeSlider
                            className={styles['volume-slider']}
                            volume={volume}
                            muted={muted}
                            onVolumeChangeRequested={onVolumeChangeRequested}
                        />
                        : null
                }
                <div className={styles['spacing']} />
                {
                    metaItem?.content?.videos?.length > 0 ?
                        <Button className={styles['episodes-button']} title={'Episodes'} tabIndex={-1} onMouseDown={onVideosButtonMouseDown} onClick={onToggleSideDrawer}>
                            <Icon className={styles['icon']} name={'episodes'} />
                            <div className={styles['label']}>Episodes</div>
                        </Button>
                        :
                        null
                }
                <Button className={styles['control-bar-buttons-menu-button']} onClick={toggleButtonsMenu}>
                    <Icon className={styles['icon']} name={'more-vertical'} />
                </Button>
                <div className={classnames(styles['control-bar-buttons-menu-container'], { 'open': buttonsMenuOpen })}>
                    {
                        statisticsAvailable &&
                            <Button className={styles['control-bar-button']} tabIndex={-1} onMouseDown={onStatisticsButtonMouseDown} onClick={onToggleStatisticsMenu}>
                                <Icon className={styles['icon']} name={'network'} />
                            </Button>
                    }
                    <Button className={classnames(styles['control-bar-button'], styles['speed-chip'], { 'disabled': playbackSpeed === null })} title={t('PLAYER_SPEED')} tabIndex={-1} onMouseDown={onSpeedButtonMouseDown} onClick={onToggleSpeedMenu}>
                        <span className={styles['speed-chip-label']}>{typeof playbackSpeed === 'number' ? `${playbackSpeed}x` : '1x'}</span>
                    </Button>
                    <Button className={classnames(styles['control-bar-button'], { 'disabled': castButtonDisabled })} tabIndex={-1} onMouseDown={onCastDevicesButtonMouseDown} onClick={onChromecastButtonClick}>
                        <Icon className={styles['icon']} name={'cast'} />
                    </Button>
                    <Button className={classnames(styles['control-bar-button'], { 'disabled': !Array.isArray(subtitlesTracks) || subtitlesTracks.length === 0 })} tabIndex={-1} onMouseDown={onSubtitlesButtonMouseDown} onClick={onToggleSubtitlesMenu}>
                        <Icon className={styles['icon']} name={'subtitles'} />
                    </Button>
                    <Button className={classnames(styles['control-bar-button'], { 'disabled': !Array.isArray(audioTracks) || audioTracks.length === 0 })} tabIndex={-1} onMouseDown={onAudioButtonMouseDown} onClick={onToggleAudioMenu}>
                        <Icon className={styles['icon']} name={'audio-tracks'} />
                    </Button>
                    <Button className={styles['control-bar-button']} title={'Search'} tabIndex={-1} onMouseDown={onSearchButtonMouseDown} onClick={onToggleSearchPanel}>
                        <Icon className={styles['icon']} name={'search'} />
                    </Button>
                    <Button className={styles['control-bar-button']} title={'Ask WTSH'} tabIndex={-1} onMouseDown={onChatButtonMouseDown} onClick={onToggleChatPanel}>
                        <ChatIcon className={styles['icon']} outline />
                    </Button>
                    <Button className={classnames(styles['control-bar-button'], { 'disabled': videoScale === null })} title={videoScaleLabel} tabIndex={-1} onClick={onVideoScaleChanged}>
                        <Icon className={styles['icon']} name={'aspect-ratio'} />
                    </Button>
                    <Button className={classnames(styles['control-bar-button'], { 'disabled': !stream })} tabIndex={-1} onMouseDown={onOptionsButtonMouseDown} onClick={onToggleOptionsMenu}>
                        <Icon className={styles['icon']} name={'more-horizontal'} />
                    </Button>
                </div>
            </div>
        </div>
    );
});

ControlBar.propTypes = {
    className: PropTypes.string,
    paused: PropTypes.bool,
    time: PropTypes.number,
    duration: PropTypes.number,
    buffered: PropTypes.number,
    volume: PropTypes.number,
    muted: PropTypes.bool,
    playbackSpeed: PropTypes.number,
    videoScale: PropTypes.string,
    videoScaleLabel: PropTypes.string,
    onVideoScaleChanged: PropTypes.func,
    subtitlesTracks: PropTypes.array,
    audioTracks: PropTypes.array,
    metaItem: PropTypes.object,
    nextVideo: PropTypes.object,
    stream: PropTypes.object,
    statisticsAvailable: PropTypes.bool,
    onPlayRequested: PropTypes.func,
    onPauseRequested: PropTypes.func,
    onNextVideoRequested: PropTypes.func,
    onMuteRequested: PropTypes.func,
    onUnmuteRequested: PropTypes.func,
    onVolumeChangeRequested: PropTypes.func,
    onSeekRequested: PropTypes.func,
    onSeekPrev: PropTypes.func,
    onSeekNext: PropTypes.func,
    seekTimeDuration: PropTypes.number,
    onToggleSubtitlesMenu: PropTypes.func,
    onToggleAudioMenu: PropTypes.func,
    onToggleSpeedMenu: PropTypes.func,
    onToggleSideDrawer: PropTypes.func,
    onToggleSearchPanel: PropTypes.func,
    onToggleChatPanel: PropTypes.func,
    onToggleOptionsMenu: PropTypes.func,
    shellCastSupported: PropTypes.bool,
    onToggleCastDevicesMenu: PropTypes.func,
    onToggleStatisticsMenu: PropTypes.func,
    onMouseOver: PropTypes.func,
    onMouseMove: PropTypes.func,
    onTouchEnd: PropTypes.func,
};

module.exports = ControlBar;
