// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useParams, useNavigate } = require('react-router');
const { useSearchParams } = require('react-router-dom');
const classnames = require('classnames');
const debounce = require('lodash.debounce');
const langs = require('langs');
const { useTranslation } = require('react-i18next');
const { default: useRouteFocused } = require('stremio/common/useRouteFocused');
const { useCore } = require('stremio/core');
const { useServices, useGamepad } = require('stremio/services');
const { useContentGamepadNavigation } = require('stremio/services/GamepadNavigation');
const { useSettings, useProfile, useFullscreen, useBinaryState, useToast, useStreamingServer, useModelState, withCoreSuspender, usePlatform, onShortcut, getKeyboardShortcutKey, getKeyboardShortcutKeys, useDiscord, EMPTY_DISCORD_TIMESTAMPS, getPlaybackDiscordActivity } = require('stremio/common');
const { default: toPath } = require('stremio-router/toPath');
const { HorizontalNavBar, MainNavBars, Transition, ContextMenu } = require('stremio/components');
const { default: Buffering } = require('./Buffering');
const VolumeChangeIndicator = require('./VolumeChangeIndicator');
const Error = require('./Error');
const ControlBar = require('./ControlBar');
const CenterControls = require('./CenterControls');
const NextVideoPopup = require('./NextVideoPopup');
const StatisticsMenu = require('./StatisticsMenu');
const OptionsMenu = require('./OptionsMenu');
const { default: CastDevicesMenu } = require('./CastDevicesMenu');
const { default: StreamingServerMenu } = require('./StreamingServerMenu');
const SubtitlesMenu = require('./SubtitlesMenu');
const { default: AudioMenu } = require('./AudioMenu');
const SpeedMenu = require('./SpeedMenu');
const { default: SideDrawerButton } = require('./SideDrawerButton');
const { default: SideDrawer } = require('./SideDrawer');
const SearchPanel = require('./SearchPanel');
const ChatPanel = require('stremio/routes/Chat/ChatPanel');
const useMetaDetails = require('stremio/routes/MetaDetails/useMetaDetails');
const usePlayer = require('./usePlayer');
const { default: usePlayOnDevice } = require('./usePlayOnDevice');
const { default: useKeyboardSeek } = require('./useKeyboardSeek');
const { default: useStatistics } = require('./useStatistics');
const useVideo = require('./useVideo');
const { default: useSubtitles } = require('./useSubtitles');
const styles = require('./styles');
const Video = require('./Video');
const { default: Indicator } = require('./Indicator/Indicator');
const { default: useMediaSession } = require('./useMediaSession');

const findTrackByLang = (tracks, lang) => tracks.find((track) => track.lang === lang || langs.where('1', track.lang)?.[2] === lang);
const findTrackById = (tracks, id) => tracks.find((track) => track.id === id);

// Distinct from the 'player' id MainNavBars registers its own useContentGamepadNavigation
// under for this route (keyed off the route name) - now that Player renders inside MainNavBars
// instead of as a standalone fullscreen overlay, both hooks are mounted at once, and sharing
// the exact same id would make the second one to register silently overwrite the first's
// gamepad.on('analog'/'buttonA', ...) handlers instead of both coexisting.
const GAMEPAD_HANDLER_ID = 'player-video';

const CAST_DEVICES_REFRESH_INTERVAL = 5000;

const Player = () => {
    const { stream, streamTransportUrl, metaTransportUrl, type, id, videoId } = useParams();
    const urlParams = React.useMemo(() => ({
        stream,
        streamTransportUrl,
        metaTransportUrl,
        type,
        id,
        videoId
    }), [stream, streamTransportUrl, metaTransportUrl, type, id, videoId]);
    const [queryParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const services = useServices();
    const core = useCore();
    const gamepad = useGamepad();
    const forceTranscoding = React.useMemo(() => {
        return queryParams.has('forceTranscoding');
    }, [queryParams]);
    const profile = useProfile();
    const ctx = useModelState({ model: 'ctx' });
    const [player, videoParamsChanged, streamStateChanged, subtitlePreferenceChanged, timeChanged, seek, pausedChanged, ended, nextVideo] = usePlayer(urlParams);
    const [settings] = useSettings();
    const streamingServer = useStreamingServer();
    const statistics = useStatistics(player, streamingServer);
    const video = useVideo();
    const routeFocused = useRouteFocused();
    const platform = usePlatform();
    const toast = useToast();
    const discord = useDiscord();
    const discordTimestamps = React.useRef(EMPTY_DISCORD_TIMESTAMPS);

    const [seeking, setSeeking] = React.useState(false);

    const [casting, setCasting] = React.useState(() => {
        return services.chromecast.active && services.chromecast.transport.getCastState() === cast.framework.CastState.CONNECTED;
    });
    const playbackDevices = React.useMemo(() => streamingServer.playbackDevices !== null && streamingServer.playbackDevices.type === 'Ready' ? streamingServer.playbackDevices.content : [], [streamingServer]);

    const playerRef = React.useRef(null);
    const bufferingRef = React.useRef();
    const errorRef = React.useRef();

    const [immersed, setImmersed] = React.useState(true);
    const setImmersedDebounced = React.useCallback(debounce(setImmersed, 3000), []);
    const [fullscreen, , , toggleFullscreen, , setVideoElement] = useFullscreen();

    React.useEffect(() => {
        const el = video.containerRef.current?.querySelector('video');
        setVideoElement(el || null);
        return () => setVideoElement(null);
    }, [video.state.manifest]);

    const [optionsMenuOpen, , closeOptionsMenu, toggleOptionsMenu] = useBinaryState(false);
    const [subtitlesMenuOpen, , closeSubtitlesMenu, toggleSubtitlesMenu] = useBinaryState(false);
    const [audioMenuOpen, , closeAudioMenu, toggleAudioMenu] = useBinaryState(false);
    const [speedMenuOpen, , closeSpeedMenu, toggleSpeedMenu] = useBinaryState(false);
    const [statisticsMenuOpen, openStatisticsMenu, closeStatisticsMenu, toggleStatisticsMenu] = useBinaryState(false);
    const [castDevicesMenuOpen, , closeCastDevicesMenu, toggleCastDevicesMenu] = useBinaryState(false);
    const [streamingServerMenuOpen, , closeStreamingServerMenu, toggleStreamingServerMenu] = useBinaryState(false);
    const [nextVideoPopupOpen, openNextVideoPopup, closeNextVideoPopup] = useBinaryState(false);
    // Opens automatically once real data is ready (see the effect below) rather than starting
    // true - this is the one real info panel for the title (compact MetaPreview inside
    // SideDrawer.tsx), so it needs to be visible without a click rather than living behind a
    // menu the user has to go find. A separate always-on panel below the video was tried first
    // and dropped - it duplicated this exact content instead of reusing it. Can't just default
    // the raw state to true though: SideDrawer.tsx reads props.metaItem.videos with no
    // undefined guard, and player.metaItem is still null for the first render or two while the
    // real data loads - opening it before then crashed the route.
    const [sideDrawerOpen, openSideDrawer, closeSideDrawer, toggleSideDrawer] = useBinaryState(false);
    const autoOpenedSideDrawerRef = React.useRef(false);
    React.useEffect(() => {
        if (!autoOpenedSideDrawerRef.current && player.metaItem?.type === 'Ready') {
            autoOpenedSideDrawerRef.current = true;
            openSideDrawer();
        }
    }, [player.metaItem, openSideDrawer]);
    const [searchPanelOpen, , closeSearchPanel, toggleSearchPanel] = useBinaryState(false);
    const [chatPanelOpen, , closeChatPanel, toggleChatPanel] = useBinaryState(false);

    const menusOpen = React.useMemo(() => {
        return optionsMenuOpen || subtitlesMenuOpen || audioMenuOpen || speedMenuOpen || statisticsMenuOpen || castDevicesMenuOpen || streamingServerMenuOpen || sideDrawerOpen || searchPanelOpen || chatPanelOpen || nextVideoPopupOpen;
    }, [optionsMenuOpen, subtitlesMenuOpen, audioMenuOpen, speedMenuOpen, statisticsMenuOpen, castDevicesMenuOpen, streamingServerMenuOpen, sideDrawerOpen, searchPanelOpen, chatPanelOpen, nextVideoPopupOpen]);

    const closeMenus = React.useCallback(() => {
        closeOptionsMenu();
        closeSubtitlesMenu();
        closeAudioMenu();
        closeSpeedMenu();
        closeStatisticsMenu();
        closeCastDevicesMenu();
        closeStreamingServerMenu();
        closeSideDrawer();
        closeSearchPanel();
        closeChatPanel();
    }, []);

    const castDevices = React.useMemo(() => {
        return playbackDevices
            .filter(({ type }) => type === 'chromecast' || type === 'tv')
            .sort((a, b) => a.type === b.type ? 0 : a.type === 'chromecast' ? -1 : 1);
    }, [playbackDevices]);
    const [castDevicesSearching, setCastDevicesSearching] = React.useState(false);
    const castDevicesLoading = platform.shell.active && (castDevicesSearching || (streamingServer.playbackDevices !== null && streamingServer.playbackDevices.type === 'Loading'));
    const { streamingUrl: castStreamingUrl, playOnDevice } = usePlayOnDevice(player.selected?.stream ?? null);
    const shellCastSupported = platform.shell.active && castStreamingUrl !== null;
    const refreshCastDevices = React.useCallback(() => {
        if (platform.shell.active) {
            core.transport.dispatch({
                action: 'StreamingServer',
                args: {
                    action: 'RefreshPlaybackDevices',
                }
            });
        }
    }, [platform.shell.active]);
    const onCastDeviceSelected = React.useCallback((deviceId) => {
        playOnDevice(deviceId, video.state.time);
        closeCastDevicesMenu();
    }, [playOnDevice, video.state.time]);
    React.useEffect(() => {
        if (castDevicesMenuOpen && platform.shell.active) {
            setCastDevicesSearching(true);
            refreshCastDevices();
            const interval = setInterval(refreshCastDevices, CAST_DEVICES_REFRESH_INTERVAL);
            const timeout = setTimeout(() => setCastDevicesSearching(false), CAST_DEVICES_REFRESH_INTERVAL);
            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
                setCastDevicesSearching(false);
            };
        }
    }, [castDevicesMenuOpen, refreshCastDevices]);

    const onStreamingServerUrlSelected = React.useCallback((url) => {
        if (url !== profile.settings.streamingServerUrl) {
            core.transport.dispatch({
                action: 'Ctx',
                args: {
                    action: 'UpdateSettings',
                    args: {
                        ...profile.settings,
                        streamingServerUrl: url,
                    }
                }
            });
        }
        closeStreamingServerMenu();
    }, [profile.settings]);

    // Auto-fallback: if the active streaming server URL fails to connect (the real,
    // observable "Err" status streamingServer.settings already exposes - see Settings'
    // own URLsManager/Item.tsx), try the next configured URL instead of hanging forever.
    // Only kicks in while actually trying to play something, and only tries each
    // configured URL once per stream to avoid ping-ponging between two broken servers.
    const triedStreamingServerUrls = React.useRef(new Set());
    React.useEffect(() => {
        triedStreamingServerUrls.current = new Set();
    }, [player.selected?.stream]);
    React.useEffect(() => {
        if (player.selected?.stream && streamingServer.settings?.type === 'Err' && Array.isArray(ctx.streamingServerUrls) && ctx.streamingServerUrls.length > 1) {
            triedStreamingServerUrls.current.add(profile.settings.streamingServerUrl);
            const nextUrl = ctx.streamingServerUrls.find(({ url }) => !triedStreamingServerUrls.current.has(url));
            if (nextUrl) {
                toast.show({
                    type: 'info',
                    title: 'Switching streaming server',
                    message: `"${profile.settings.streamingServerUrl}" isn't responding - trying "${nextUrl.url}" instead.`,
                    timeout: 4000
                });
                core.transport.dispatch({
                    action: 'Ctx',
                    args: {
                        action: 'UpdateSettings',
                        args: {
                            ...profile.settings,
                            streamingServerUrl: nextUrl.url,
                        }
                    }
                });
            }
        }
    }, [player.selected?.stream, streamingServer.settings?.type, ctx.streamingServerUrls, profile.settings.streamingServerUrl]);

    const {
        streamSubtitles,
        allSubtitleTracks,
        extraSubtitleTracks,
        selectedExtraSubtitleTrackId,
        subtitlesMenuProps,
    } = useSubtitles({
        player,
        video,
        settings,
        streamStateChanged,
        subtitlePreferenceChanged,
        menusOpen,
        closeMenus,
        closeSubtitlesMenu,
        toggleSubtitlesMenu,
    });

    const nextVideoPopupDismissed = React.useRef(false);
    const defaultAudioTrackSelected = React.useRef(false);
    const playingOnExternalDevice = React.useRef(false);
    const [error, setError] = React.useState(null);

    // Auto-fallback to a different stream/source when the one actually playing fails outright
    // (video.events' 'error' with .critical - the same real signal Error.js already renders
    // from below, not a fabricated "not working" detector). Only fetches the full cross-addon
    // streams list (the same useMetaDetails hook MetaDetails' own StreamsList already uses)
    // lazily, after a real failure - not eagerly on every player mount, which would mean a
    // second full addon fetch on every successful playback too.
    const streamFallbackUrlParams = React.useMemo(() => {
        return error !== null ? { type, id, videoId } : {};
    }, [error, type, id, videoId]);
    const streamFallbackMetaDetails = useMetaDetails(streamFallbackUrlParams);
    const triedStreamPlayerLinks = React.useRef(new Set());
    React.useEffect(() => {
        triedStreamPlayerLinks.current = new Set();
    }, [videoId]);
    React.useEffect(() => {
        if (error === null) {
            return;
        }

        const failedStreamLink = player.selected?.stream?.deepLinks?.player;
        if (typeof failedStreamLink === 'string') {
            triedStreamPlayerLinks.current.add(failedStreamLink);
        }

        const stillLoading = streamFallbackMetaDetails.streams.some((streams) => streams.content.type === 'Loading');
        if (stillLoading) {
            return;
        }

        const allStreams = streamFallbackMetaDetails.streams
            .filter((streams) => streams.content.type === 'Ready')
            .flatMap((streams) => streams.content.content);
        const nextStream = allStreams.find((stream) => {
            const link = stream.deepLinks?.player;
            return typeof link === 'string' && !triedStreamPlayerLinks.current.has(link);
        });

        if (nextStream) {
            toast.show({
                type: 'info',
                title: 'Trying another source',
                message: 'That source failed to play - trying a different one.',
                timeout: 4000
            });
            navigate(toPath(nextStream.deepLinks.player), { replace: true });
        }
    }, [error, streamFallbackMetaDetails.streams]);

    const VIDEO_SCALES = ['contain', 'cover', 'fill'];
    const VIDEO_SCALE_LABELS = { contain: t('PLAYER_SCALE_FIT'), cover: t('PLAYER_SCALE_CROP'), fill: t('PLAYER_SCALE_STRETCH') };

    const playbackSpeed = React.useRef(video.state.playbackSpeed || 1);
    const pressTimer = React.useRef(null);
    const longPress = React.useRef(false);
    const detailsHold = React.useRef(null);
    const controlBarRef = React.useRef(null);

    const HOLD_DELAY = 400;

    const handleNextVideoNavigation = React.useCallback((deepLinks, bingeWatching, ended) => {
        if (ended) {
            if (bingeWatching) {
                if (deepLinks.player) {
                    navigate(toPath(deepLinks.player), { replace: true });
                } else if (deepLinks.metaDetailsStreams) {
                    navigate(toPath(deepLinks.metaDetailsStreams), { replace: true });
                }
            } else {
                navigate(-1);
            }

        } else {
            if (deepLinks.player) {
                navigate(toPath(deepLinks.player), { replace: true });
            } else if (deepLinks.metaDetailsStreams) {
                navigate(toPath(deepLinks.metaDetailsStreams), { replace: true });
            }
        }
    }, []);

    const onEnded = React.useCallback(() => {
        ended();
        if (player.nextVideo !== null) {
            nextVideo();

            const deepLinks = player.nextVideo.deepLinks;
            handleNextVideoNavigation(deepLinks, profile.settings.bingeWatching, true);
        } else {
            navigate(-1);
        }
    }, [player.nextVideo, profile.settings.bingeWatching, handleNextVideoNavigation]);

    const onError = React.useCallback((error) => {
        console.error('Player', error);
        if (error.critical) {
            setError(error);
        } else {
            toast.show({
                type: 'error',
                title: t('ERROR'),
                message: error.message,
                timeout: 3000
            });
        }
    }, []);

    const onPlayRequested = React.useCallback(() => {
        playingOnExternalDevice.current = false;
        video.setPaused(false);
        setSeeking(false);
    }, []);

    const onPlayRequestedDebounced = React.useCallback(debounce(onPlayRequested, 200), []);

    const onPauseRequested = React.useCallback(() => {
        video.setPaused(true);
    }, []);

    const onPauseRequestedDebounced = React.useCallback(debounce(onPauseRequested, 200), []);
    const onMuteRequested = React.useCallback(() => {
        video.setMuted(true);
    }, []);

    const onUnmuteRequested = React.useCallback(() => {
        video.setMuted(false);
    }, []);

    const onVolumeChangeRequested = React.useCallback((volume) => {
        video.setVolume(volume);
    }, []);

    const commitSeek = React.useCallback((time) => {
        video.setTime(time);
        seek(time, video.state.duration, video.state.manifest?.name);
    }, [video.state.duration, video.state.manifest]);
    const {
        time: keyboardSeekTime,
        seekBy: seekByKeyboard,
        seekTo: onSeekRequested,
        cancel: cancelKeyboardSeek,
        flush: flushKeyboardSeek,
        release: releaseKeyboardSeek,
    } = useKeyboardSeek({
        time: video.state.time,
        duration: video.state.duration,
        onSeek: commitSeek,
        setSeeking,
    });
    const onKeyboardSeekRequested = React.useCallback((offset) => {
        setImmersedDebounced.cancel();
        setImmersed(false);
        seekByKeyboard(offset);
    }, [seekByKeyboard]);
    const overlayHidden = React.useMemo(() => {
        return keyboardSeekTime === null && immersed && !casting && video.state.paused !== null && !video.state.paused && !menusOpen;
    }, [keyboardSeekTime, immersed, casting, video.state.paused, menusOpen]);

    React.useEffect(() => {
        if (!video.state.manifest?.props.includes('subtitlesOffsetMinimum')) {
            return;
        }

        const videoContainerElement = video.containerRef.current;
        const controlBarElement = controlBarRef.current;
        if (!videoContainerElement || !controlBarElement) {
            return;
        }

        const updateSubtitlesOffsetMinimum = () => {
            const videoHeight = videoContainerElement.getBoundingClientRect().height;
            const controlBarHeight = overlayHidden ? 0 : controlBarElement.getBoundingClientRect().height;
            const offsetMinimum = videoHeight > 0 ? Math.ceil(controlBarHeight / videoHeight * 100) : 0;
            video.setSubtitlesOffsetMinimum(offsetMinimum);
        };

        updateSubtitlesOffsetMinimum();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateSubtitlesOffsetMinimum);
            return () => window.removeEventListener('resize', updateSubtitlesOffsetMinimum);
        }

        const resizeObserver = new ResizeObserver(updateSubtitlesOffsetMinimum);
        resizeObserver.observe(videoContainerElement);
        resizeObserver.observe(controlBarElement);
        return () => resizeObserver.disconnect();
    }, [overlayHidden, video.state.manifest, video.setSubtitlesOffsetMinimum]);

    const onPlaybackSpeedChanged = React.useCallback((rate, skipUpdate) => {
        video.setPlaybackSpeed(rate);

        if (skipUpdate) return;

        playbackSpeed.current = rate;

    }, []);

    const onVideoScaleChanged = React.useCallback(() => {
        const currentScale = video.state.videoScale || 'contain';
        const currentIndex = VIDEO_SCALES.indexOf(currentScale);
        const nextScale = VIDEO_SCALES[(currentIndex + 1) % VIDEO_SCALES.length];
        video.setVideoScale(nextScale);
    }, [video.state.videoScale]);

    const onAudioTrackSelected = React.useCallback((id) => {
        video.setAudioTrack(id);
        streamStateChanged({
            audioTrack: {
                id,
            },
        });
    }, [streamStateChanged]);

    const onDismissNextVideoPopup = React.useCallback(() => {
        closeNextVideoPopup();
        nextVideoPopupDismissed.current = true;
    }, []);

    const onNextVideoRequested = React.useCallback(() => {
        if (player.nextVideo !== null) {
            cancelKeyboardSeek();
            nextVideo();

            const deepLinks = player.nextVideo.deepLinks;
            handleNextVideoNavigation(deepLinks, profile.settings.bingeWatching, false);
        }
    }, [player.nextVideo, handleNextVideoNavigation, profile.settings, cancelKeyboardSeek]);

    const onVideoClick = React.useCallback(() => {
        if (video.state.paused !== null && !longPress.current) {
            if (video.state.paused) {
                onPlayRequestedDebounced();
            } else {
                onPauseRequestedDebounced();
            }
        }
    }, [video.state.paused, longPress.current]);

    const onVideoDoubleClick = React.useCallback(() => {
        onPlayRequestedDebounced.cancel();
        onPauseRequestedDebounced.cancel();
        toggleFullscreen(playerRef.current);
    }, [toggleFullscreen]);

    const onContainerMouseDown = React.useCallback((event) => {
        if (!event.nativeEvent.optionsMenuClosePrevented) {
            closeOptionsMenu();
        }
        if (!event.nativeEvent.subtitlesMenuClosePrevented) {
            closeSubtitlesMenu();
        }
        if (!event.nativeEvent.audioMenuClosePrevented) {
            closeAudioMenu();
        }
        if (!event.nativeEvent.speedMenuClosePrevented) {
            closeSpeedMenu();
        }
        if (!event.nativeEvent.statisticsMenuClosePrevented) {
            closeStatisticsMenu();
        }
        if (!event.nativeEvent.castDevicesMenuClosePrevented) {
            closeCastDevicesMenu();
        }
        if (!event.nativeEvent.streamingServerMenuClosePrevented) {
            closeStreamingServerMenu();
        }

        closeSideDrawer();
        closeSearchPanel();
        closeChatPanel();
    }, []);

    const onContainerMouseMove = React.useCallback((event) => {
        setImmersed(false);
        if (!event.nativeEvent.immersePrevented) {
            setImmersedDebounced(true);
        } else {
            setImmersedDebounced.cancel();
        }
    }, []);

    const onContainerMouseLeave = React.useCallback(() => {
        setImmersedDebounced.cancel();
        setImmersed(true);
    }, []);

    const onBarMouseMove = React.useCallback((event) => {
        event.nativeEvent.immersePrevented = true;
    }, []);

    const onPlayPause = React.useCallback(() => {
        if (!menusOpen && !nextVideoPopupOpen && video.state.paused !== null) {
            if (video.state.paused) {
                onPlayRequested();
                setSeeking(false);
            } else {
                onPauseRequested();
            }
        }
    }, [menusOpen, nextVideoPopupOpen, video.state.paused]);

    const onSeekPrev = React.useCallback((event) => {
        if (!menusOpen && !nextVideoPopupOpen && video.state.time !== null) {
            const seekDuration = event?.shiftKey ? settings.seekShortTimeDuration : settings.seekTimeDuration;
            const seekTime = video.state.time - seekDuration;
            setSeeking(true);
            onSeekRequested(Math.max(seekTime, 0));
        }
    }, [menusOpen, nextVideoPopupOpen, video.state.time]);

    const onSeekNext = React.useCallback((event) => {
        if (!menusOpen && !nextVideoPopupOpen && video.state.time !== null) {
            const seekDuration = event?.shiftKey ? settings.seekShortTimeDuration : settings.seekTimeDuration;
            setSeeking(true);
            onSeekRequested(video.state.time + seekDuration);
        }
    }, [menusOpen, nextVideoPopupOpen, video.state.time]);

    const onVolumeUp = React.useCallback(() => {
        if (!menusOpen && !nextVideoPopupOpen && video.state.volume !== null) {
            onVolumeChangeRequested(Math.min(video.state.volume + 5, 200));
        }
    }, [menusOpen, nextVideoPopupOpen, video.state.volume]);

    const onVolumeDown = React.useCallback(() => {
        if (!menusOpen && !nextVideoPopupOpen && video.state.volume !== null) {
            onVolumeChangeRequested(Math.max(video.state.volume - 5, 0));
        }
    }, [menusOpen, nextVideoPopupOpen, video.state.volume]);

    const onGamepadSeekAndVol = React.useCallback((axis) => {
        switch(axis) {
            case 'left': {
                onSeekPrev();
                break;
            }
            case 'right': {
                onSeekNext();
                break;
            }
            case 'up': {
                onVolumeUp();
                break;
            }
            case 'down': {
                onVolumeDown();
                break;
            }
        }
    }, [onSeekPrev, onSeekNext, onVolumeUp, onVolumeDown]);

    useContentGamepadNavigation(playerRef, GAMEPAD_HANDLER_ID);

    React.useEffect(() => {
        gamepad?.on('buttonX', GAMEPAD_HANDLER_ID, onPlayPause);
        gamepad?.on('analogRight', GAMEPAD_HANDLER_ID, onGamepadSeekAndVol);

        return () => {
            gamepad?.off('buttonX', GAMEPAD_HANDLER_ID);
            gamepad?.off('analogRight', GAMEPAD_HANDLER_ID);
        };
    }, [onPlayPause, onGamepadSeekAndVol]);

    React.useEffect(() => {
        setError(null);
        cancelKeyboardSeek();
        video.unload();

        if (player.selected && player.stream?.type === 'Ready' && streamingServer.settings?.type !== 'Loading') {
            video.load({
                stream: {
                    ...player.stream.content,
                    subtitles: streamSubtitles
                },
                autoplay: true,
                time: player.libraryItem !== null &&
                    player.selected.streamRequest !== null &&
                    player.selected.streamRequest.path !== null &&
                    player.libraryItem.state.video_id === player.selected.streamRequest.path.id ?
                    player.libraryItem.state.timeOffset
                    :
                    0,
                forceTranscoding: forceTranscoding || casting,
                maxAudioChannels: settings.surroundSound ? 32 : 2,
                hardwareDecoding: settings.hardwareDecoding,
                assSubtitlesStyling: settings.assSubtitlesStyling,
                gpuVideoProcessing: settings.gpuVideoProcessing && platform.shell.capabilities.gpuVideoProcessing,
                videoMode: settings.videoMode,
                platform: platform.name,
                streamingServerURL: streamingServer.baseUrl ?
                    casting ?
                        streamingServer.baseUrl
                        :
                        streamingServer.selected.transportUrl
                    :
                    null,
                seriesInfo: player.seriesInfo,
            }, {
                chromecastTransport: services.chromecast.active ? services.chromecast.transport : null,
                shellTransport: platform.shell.active ? platform.shell : null,
            });
        }
    }, [streamingServer.baseUrl, player.selected, player.stream, streamSubtitles, forceTranscoding, casting, cancelKeyboardSeek]);

    React.useEffect(() => {
        !seeking && timeChanged(video.state.time, video.state.duration, video.state.manifest?.name);
    }, [video.state.time, video.state.duration, video.state.manifest, seeking]);

    React.useEffect(() => {
        if (playingOnExternalDevice.current && video.state.paused === false) {
            onPauseRequested();
        } else if (video.state.paused !== null) {
            pausedChanged(video.state.paused);
        }
    }, [video.state.paused]);

    React.useEffect(() => {
        videoParamsChanged(video.state.videoParams);
    }, [video.state.videoParams]);

    React.useEffect(() => {
        if (player.nextVideo !== null && !nextVideoPopupDismissed.current) {
            if (video.state.time !== null && video.state.duration !== null && video.state.time < video.state.duration && (video.state.duration - video.state.time) <= settings.nextVideoNotificationDuration) {
                openNextVideoPopup();
            } else {
                closeNextVideoPopup();
            }
        }
    }, [player.nextVideo, video.state.time, video.state.duration]);

    // Auto audio track selection
    React.useEffect(() => {
        if (!defaultAudioTrackSelected.current) {
            const savedTrackId = player.streamState?.audioTrack?.id;
            const savedTrack = savedTrackId ? findTrackById(video.state.audioTracks, savedTrackId) : null;
            const audioTrack = savedTrack ?? findTrackByLang(video.state.audioTracks, settings.audioLanguage);

            if (audioTrack && audioTrack.id) {
                video.setAudioTrack(audioTrack.id);
                defaultAudioTrackSelected.current = true;
            }
        }
    }, [video.state.audioTracks, player.streamState]);

    React.useEffect(() => {
        defaultAudioTrackSelected.current = false;
        nextVideoPopupDismissed.current = false;
        playingOnExternalDevice.current = false;
    }, [video.state.stream]);

    React.useEffect(() => {
        if (!Array.isArray(video.state.audioTracks) || video.state.audioTracks.length === 0) {
            closeAudioMenu();
        }
    }, [video.state.audioTracks]);

    React.useEffect(() => {
        if (video.state.playbackSpeed === null) {
            closeSpeedMenu();
        }
    }, [video.state.playbackSpeed]);

    React.useEffect(() => {
        const toastFilter = (item) => item?.dataset?.type === 'CoreEvent';
        toast.addFilter(toastFilter);
        const onCastStateChange = () => {
            setCasting(services.chromecast.active && services.chromecast.transport.getCastState() === cast.framework.CastState.CONNECTED);
        };
        const onChromecastServiceStateChange = () => {
            onCastStateChange();
            if (services.chromecast.active) {
                services.chromecast.transport.on(
                    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                    onCastStateChange
                );
            }
        };
        const onCoreEvent = (name) => {
            if (name === 'PlayingOnDevice') {
                playingOnExternalDevice.current = true;
                onPauseRequested();
            }
        };
        services.chromecast.on('stateChanged', onChromecastServiceStateChange);
        core.on('event', onCoreEvent);
        onChromecastServiceStateChange();
        return () => {
            toast.removeFilter(toastFilter);
            services.chromecast.off('stateChanged', onChromecastServiceStateChange);
            core.off('event', onCoreEvent);
            if (services.chromecast.active) {
                services.chromecast.transport.off(
                    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                    onCastStateChange
                );
            }
        };
    }, []);

    React.useEffect(() => {
        if (settings.pauseOnMinimize && (platform.shell.state.windowClosed || platform.shell.state.windowHidden)) {
            onPauseRequested();
        }
    }, [settings.pauseOnMinimize, platform.shell.state.windowClosed, platform.shell.state.windowHidden]);

    React.useEffect(() => {
        if (video.state.stream === null || typeof player?.title !== 'string') {
            discordTimestamps.current = EMPTY_DISCORD_TIMESTAMPS;
            discord.setActivity(null);
            return;
        }

        const metaItem = player.metaItem?.type === 'Ready' ? player.metaItem.content : null;
        const { activity, timestamps } = getPlaybackDiscordActivity({
            title: player.title,
            image: metaItem?.poster || metaItem?.background || null,
            paused: video.state.paused,
            time: video.state.time,
            duration: video.state.duration,
            timestamps: discordTimestamps.current,
        });

        discordTimestamps.current = timestamps;
        discord.setActivity(activity);
    }, [discord.setActivity, player?.title, player.metaItem, video.state.duration, video.state.paused, video.state.stream, video.state.time]);

    React.useEffect(() => {
        return () => {
            discord.setActivity(null);
        };
    }, [discord.setActivity]);

    useMediaSession(video.state, player, fullscreen, onPlayRequested, onPauseRequested, onNextVideoRequested);

    React.useEffect(() => {
        const onMediaKey = (action) => {
            switch (action) {
                case 'play-pause':
                    if (video.state.paused !== null) {
                        video.state.paused ? onPlayRequested() : onPauseRequested();
                    }
                    break;
                case 'play':
                    onPlayRequested();
                    break;
                case 'pause':
                    onPauseRequested();
                    break;
                case 'next-track':
                    if (player.nextVideo !== null) {
                        video.setTime(0);
                        onNextVideoRequested();
                    }
                    break;
            }
        };
        platform.shell.on('media-key', onMediaKey);
        return () => platform.shell.off('media-key', onMediaKey);
    }, [video.state.paused, player.nextVideo, onPlayRequested, onPauseRequested, onNextVideoRequested]);

    onShortcut('seekForward', (combo) => {
        const seekDuration = combo === 1 ? settings.seekShortTimeDuration : settings.seekTimeDuration;
        onKeyboardSeekRequested(seekDuration);
    }, [settings.seekShortTimeDuration, settings.seekTimeDuration, onKeyboardSeekRequested], !menusOpen);

    onShortcut('seekBackward', (combo) => {
        const seekDuration = combo === 1 ? settings.seekShortTimeDuration : settings.seekTimeDuration;
        onKeyboardSeekRequested(-seekDuration);
    }, [settings.seekShortTimeDuration, settings.seekTimeDuration, onKeyboardSeekRequested], !menusOpen);

    onShortcut('mute', () => {
        video.state.muted === true ? onUnmuteRequested() : onMuteRequested();
    }, [video.state.muted], !menusOpen);

    onShortcut('volume', (combo) => {
        if (video.state.volume !== null) {
            const volume = combo === 0 ? Math.min(video.state.volume + 5, 200) : Math.max(video.state.volume - 5, 0);
            onVolumeChangeRequested(volume);
        }
    }, [video.state.volume], !menusOpen);

    onShortcut('audioMenu', () => {
        closeMenus();
        if (video.state?.audioTracks?.length > 0) {
            toggleAudioMenu();
        }
    }, [video.state.audioTracks, toggleAudioMenu]);

    onShortcut('infoMenu', () => {
        closeMenus();
        if (player.metaItem?.type === 'Ready') {
            toggleSideDrawer();
        }
    }, [player.metaItem, toggleSideDrawer]);

    onShortcut('speedMenu', () => {
        closeMenus();
        if (video.state.playbackSpeed !== null) {
            toggleSpeedMenu();
        }
    }, [video.state.playbackSpeed, toggleSpeedMenu]);

    onShortcut('speed', (combo) => {
        if (video.state.playbackSpeed !== null) {
            const speed = combo === 0 ? Math.max(video.state.playbackSpeed - 0.25, 0.25) : Math.min(video.state.playbackSpeed + 0.25, 2);
            onPlaybackSpeedChanged(speed);
        }
    }, [video.state.playbackSpeed, onPlaybackSpeedChanged], !menusOpen);

    const selectedStream = player.selected?.stream;
    const statisticsMenuAvailable = streamingServer?.statistics?.type !== 'Err'
        && typeof selectedStream?.infoHash === 'string'
        && typeof selectedStream?.fileIdx === 'number';

    const finishDetailsHold = React.useCallback(() => {
        const hold = detailsHold.current;
        if (hold === null) return null;

        detailsHold.current = null;
        if (hold.phase === 'pending') {
            clearTimeout(hold.timer);
        } else {
            closeStatisticsMenu();
        }
        return hold.phase;
    }, [closeStatisticsMenu]);

    const releaseDetailsHold = React.useCallback(() => {
        if (finishDetailsHold() !== 'pending') return;

        closeMenus();
        if (statisticsMenuAvailable) {
            toggleStatisticsMenu();
        }
    }, [finishDetailsHold, closeMenus, statisticsMenuAvailable, toggleStatisticsMenu]);

    onShortcut('statisticsMenu', () => {
        if (detailsHold.current !== null || pressTimer.current !== null) return;

        const hold = { phase: 'pending', timer: null };
        hold.timer = setTimeout(() => {
            hold.phase = 'held';
            hold.timer = null;
            if (statisticsMenuAvailable) {
                closeMenus();
                openStatisticsMenu();
            }
        }, HOLD_DELAY);
        detailsHold.current = hold;
    }, [statisticsMenuAvailable, closeMenus, openStatisticsMenu], routeFocused);

    onShortcut('playNext', () => {
        closeMenus();
        if (player.nextVideo !== null) {
            nextVideo();
            const deepLinks = player.nextVideo.deepLinks;
            handleNextVideoNavigation(deepLinks, false, false);
        }
    }, [player.nextVideo, handleNextVideoNavigation]);

    onShortcut('exit', () => {
        closeMenus();
        // When escExitFullscreen is enabled, FullscreenProvider handles the first
        // Escape press by leaving fullscreen. Only skip navigating back in that case,
        // otherwise Escape would never exit the player in windowed mode.
        if (settings.escExitFullscreen && fullscreen) {
            return;
        }
        navigate(-1);
    }, [settings.escExitFullscreen, fullscreen]);

    React.useLayoutEffect(() => {
        if (!routeFocused) {
            finishDetailsHold();
        }

        if (menusOpen) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
            longPress.current = false;
        }

        const onKeyDown = (e) => {
            const keyboardKey = getKeyboardShortcutKey(e);
            if (keyboardKey !== 'Space' || e.repeat) return;
            if (menusOpen || detailsHold.current !== null || e.ctrlKey || e.metaKey || e.altKey) return;

            longPress.current = false;

            pressTimer.current = setTimeout(() => {
                longPress.current = true;
                onPlaybackSpeedChanged(2, true);
            }, HOLD_DELAY);
        };

        const onKeyUp = (e) => {
            const keyboardKeys = getKeyboardShortcutKeys(e);

            if (keyboardKeys.includes('KeyD') || keyboardKeys.includes('D')) {
                releaseDetailsHold();
                return;
            }

            if (!keyboardKeys.includes('Space') && !keyboardKeys.includes('ArrowRight') && !keyboardKeys.includes('ArrowLeft')) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (keyboardKeys.includes('ArrowRight') || keyboardKeys.includes('ArrowLeft')) {
                releaseKeyboardSeek();
                setImmersed(false);
                setImmersedDebounced(true);
                return;
            }
            if (keyboardKeys.includes('Space')) {
                clearTimeout(pressTimer.current);
                pressTimer.current = null;
                if (longPress.current) {
                    onPlaybackSpeedChanged(playbackSpeed.current);
                } else if (!menusOpen && video.state.paused !== null) {
                    if (video.state.paused) {
                        onPlayRequested();
                        setSeeking(false);
                    } else {
                        onPauseRequested();
                    }
                }
                longPress.current = false;
            }
        };

        const onWheel = ({ deltaY }) => {
            if (menusOpen || video.state.volume === null) return;

            if (deltaY > 0) {
                onVolumeChangeRequested(Math.max(video.state.volume - 5, 0));
            } else {
                if (video.state.volume < 100) {
                    onVolumeChangeRequested(Math.min(video.state.volume + 5, 100));
                }
            }
        };

        const onMouseDownHold = (e) => {
            if (e.button !== 0) return; // left mouse button only
            if (menusOpen || detailsHold.current !== null) return;
            if (controlBarRef.current && controlBarRef.current.contains(e.target)) return;

            longPress.current = false;

            pressTimer.current = setTimeout(() => {
                longPress.current = true;
                onPlaybackSpeedChanged(2, true);
            }, HOLD_DELAY);
        };

        const onMouseUp = (e) => {
            if (e.button !== 0) return;

            clearTimeout(pressTimer.current);
            pressTimer.current = null;

            if (longPress.current) {
                onPlaybackSpeedChanged(playbackSpeed.current);
            }
        };

        const onBlur = () => {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
            if (longPress.current) {
                onPlaybackSpeedChanged(playbackSpeed.current);
                longPress.current = false;
            }
            finishDetailsHold();
            flushKeyboardSeek();
            setImmersed(false);
            setImmersedDebounced(true);
        };

        if (routeFocused) {
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('wheel', onWheel);
            window.addEventListener('mousedown', onMouseDownHold);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('blur', onBlur);
        } else {
            cancelKeyboardSeek();
        }
        return () => {
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousedown', onMouseDownHold);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onBlur);
        };
    }, [routeFocused, menusOpen, video.state.volume, video.state.paused, finishDetailsHold, releaseDetailsHold, cancelKeyboardSeek, flushKeyboardSeek, releaseKeyboardSeek]);

    React.useEffect(() => {
        video.events.on('error', onError);
        video.events.on('ended', onEnded);

        return () => {
            video.events.off('error', onError);
            video.events.off('ended', onEnded);
        };
    }, [onEnded]);

    React.useLayoutEffect(() => {
        return () => {
            clearTimeout(detailsHold.current?.timer);
            setImmersedDebounced.cancel();
            onPlayRequestedDebounced.cancel();
            onPauseRequestedDebounced.cancel();
        };
    }, []);

    return (
        <MainNavBars route={'player'}>
        <div ref={playerRef} className={classnames(styles['player-container'], { [styles['overlayHidden']]: overlayHidden })}
            onMouseDown={onContainerMouseDown}
            onMouseMove={onContainerMouseMove}
            onMouseOver={onContainerMouseMove}
            onMouseLeave={onContainerMouseLeave}>
            <Video
                ref={video.containerRef}
                className={styles['layer']}
                onClick={onVideoClick}
                onDoubleClick={onVideoDoubleClick}
            />
            {
                !video.state.loaded ?
                    <div className={classnames(styles['layer'], styles['background-layer'])}>
                        <img className={styles['image']} src={player?.metaItem?.content?.background} />
                    </div>
                    :
                    null
            }
            {
                (video.state.buffering || !video.state.loaded) && !error ?
                    <Buffering
                        ref={bufferingRef}
                        className={classnames(styles['layer'], styles['buffering-layer'])}
                        logo={player?.metaItem?.content?.logo}
                        progress={statistics.progress}
                    />
                    :
                    null
            }
            {
                error !== null ?
                    <Error
                        ref={errorRef}
                        className={classnames(styles['layer'], styles['error-layer'])}
                        stream={video.state.stream}
                        {...error}
                    />
                    :
                    null
            }
            {
                menusOpen ?
                    <div className={styles['layer']} />
                    :
                    null
            }
            {
                video.state.volume !== null && overlayHidden ?
                    <VolumeChangeIndicator
                        muted={video.state.muted}
                        volume={video.state.volume}
                    />
                    :
                    null
            }
            <ContextMenu on={[video.containerRef, bufferingRef, errorRef]} autoClose>
                <OptionsMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    stream={player?.selected?.stream}
                    playbackDevices={playbackDevices}
                    extraSubtitlesTracks={extraSubtitleTracks}
                    selectedExtraSubtitlesTrackId={selectedExtraSubtitleTrackId}
                />
            </ContextMenu>
            <HorizontalNavBar
                className={classnames(styles['layer'], styles['nav-bar-layer'])}
                title={player.title !== null ? player.title : ''}
                backButton={true}
                fullscreenButton={true}
                fullscreenTarget={playerRef.current}
                hdrInfo={video.state.hdrInfo}
                onMouseMove={onBarMouseMove}
                onMouseOver={onBarMouseMove}
            />
            {
                player.metaItem?.type === 'Ready' ?
                    <SideDrawerButton
                        className={classnames(styles['layer'], styles['side-drawer-button-layer'])}
                        onClick={toggleSideDrawer}
                    />
                    :
                    null
            }
            {
                !(video.state.buffering || !video.state.loaded) && error === null ?
                    <CenterControls
                        className={classnames(styles['center-controls-layer'])}
                        paused={video.state.paused}
                        seekTimeDuration={settings.seekTimeDuration}
                        onSeekPrev={onSeekPrev}
                        onSeekNext={onSeekNext}
                        onPlayRequested={onPlayRequested}
                        onPauseRequested={onPauseRequested}
                    />
                    :
                    null
            }
            <ControlBar
                ref={controlBarRef}
                className={classnames(styles['layer'], styles['control-bar-layer'])}
                paused={video.state.paused}
                time={keyboardSeekTime ?? video.state.time}
                duration={video.state.duration}
                buffered={video.state.buffered}
                volume={video.state.volume}
                muted={video.state.muted}
                playbackSpeed={video.state.playbackSpeed}
                subtitlesTracks={allSubtitleTracks}
                audioTracks={video.state.audioTracks}
                metaItem={player.metaItem}
                nextVideo={player.nextVideo}
                stream={player.selected !== null ? player.selected.stream : null}
                statisticsAvailable={statisticsMenuAvailable}
                onPlayRequested={onPlayRequested}
                onPauseRequested={onPauseRequested}
                onNextVideoRequested={onNextVideoRequested}
                onMuteRequested={onMuteRequested}
                onUnmuteRequested={onUnmuteRequested}
                onVolumeChangeRequested={onVolumeChangeRequested}
                onSeekRequested={onSeekRequested}
                onSeekPrev={onSeekPrev}
                onSeekNext={onSeekNext}
                seekTimeDuration={settings.seekTimeDuration}
                onToggleOptionsMenu={toggleOptionsMenu}
                shellCastSupported={shellCastSupported}
                onToggleCastDevicesMenu={toggleCastDevicesMenu}
                onToggleStreamingServerMenu={toggleStreamingServerMenu}
                onToggleSubtitlesMenu={toggleSubtitlesMenu}
                onToggleAudioMenu={toggleAudioMenu}
                onToggleSpeedMenu={toggleSpeedMenu}
                videoScale={video.state.videoScale}
                videoScaleLabel={VIDEO_SCALE_LABELS[video.state.videoScale || 'contain']}
                onVideoScaleChanged={onVideoScaleChanged}
                onToggleStatisticsMenu={toggleStatisticsMenu}
                onToggleSideDrawer={toggleSideDrawer}
                onToggleSearchPanel={toggleSearchPanel}
                onToggleChatPanel={toggleChatPanel}
                onMouseMove={onBarMouseMove}
                onMouseOver={onBarMouseMove}
                onTouchEnd={onContainerMouseLeave}
            />
            <Indicator
                className={classnames(styles['layer'], styles['indicator-layer'])}
                videoState={video.state}
                disabled={subtitlesMenuOpen}
            />
            {
                nextVideoPopupOpen ?
                    <NextVideoPopup
                        className={classnames(styles['layer'], styles['menu-layer'])}
                        metaItem={player.metaItem !== null && player.metaItem.type === 'Ready' ? player.metaItem.content : null}
                        nextVideo={player.nextVideo}
                        onDismiss={onDismissNextVideoPopup}
                        onNextVideoRequested={onNextVideoRequested}
                    />
                    :
                    null
            }
            <Transition when={statisticsMenuOpen} name={'fade'}>
                <StatisticsMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    {...statistics}
                />
            </Transition>
            <Transition when={castDevicesMenuOpen} name={'fade'}>
                <CastDevicesMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    devices={castDevices}
                    loading={castDevicesLoading}
                    onDeviceSelected={onCastDeviceSelected}
                />
            </Transition>
            <Transition when={streamingServerMenuOpen} name={'fade'}>
                <StreamingServerMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    urls={ctx.streamingServerUrls}
                    selectedUrl={profile.settings.streamingServerUrl}
                    status={streamingServer.settings?.type ?? null}
                    onUrlSelected={onStreamingServerUrlSelected}
                />
            </Transition>
            <Transition when={sideDrawerOpen} name={'slide-left'}>
                <SideDrawer
                    className={classnames(styles['layer'], styles['side-drawer-layer'])}
                    metaItem={player.metaItem?.content}
                    seriesInfo={player.seriesInfo}
                    closeSideDrawer={closeSideDrawer}
                    selected={player.selected?.streamRequest?.path?.id}
                />
            </Transition>
            <Transition when={searchPanelOpen} name={'slide-left'}>
                <SearchPanel
                    className={classnames(styles['layer'], styles['side-drawer-layer'])}
                    closeSearchPanel={closeSearchPanel}
                />
            </Transition>
            <Transition when={chatPanelOpen} name={'slide-left'}>
                <ChatPanel
                    className={classnames(styles['layer'], styles['side-drawer-layer'])}
                    compact
                    closeChatPanel={closeChatPanel}
                />
            </Transition>
            <Transition when={subtitlesMenuOpen} name={'fade'}>
                <SubtitlesMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    {...subtitlesMenuProps}
                />
            </Transition>
            <Transition when={audioMenuOpen} name={'fade'}>
                <AudioMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    audioTracks={video.state.audioTracks}
                    selectedAudioTrackId={video.state.selectedAudioTrackId}
                    onAudioTrackSelected={onAudioTrackSelected}
                />
            </Transition>
            <Transition when={speedMenuOpen} name={'fade'}>
                <SpeedMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    playbackSpeed={video.state.playbackSpeed}
                    onPlaybackSpeedChanged={onPlaybackSpeedChanged}
                />
            </Transition>
            <Transition when={optionsMenuOpen} name={'fade'}>
                <OptionsMenu
                    className={classnames(styles['layer'], styles['menu-layer'])}
                    stream={player.selected?.stream}
                    playbackDevices={playbackDevices}
                    extraSubtitlesTracks={extraSubtitleTracks}
                    selectedExtraSubtitlesTrackId={selectedExtraSubtitleTrackId}
                />
            </Transition>
        </div>
        </MainNavBars>
    );
};

const PlayerFallback = () => (
    <MainNavBars route={'player'}>
        <div className={classnames(styles['player-container'])} />
    </MainNavBars>
);

module.exports = withCoreSuspender(Player, PlayerFallback);
