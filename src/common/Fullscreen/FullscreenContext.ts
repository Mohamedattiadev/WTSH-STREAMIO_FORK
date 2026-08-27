// Copyright (C) 2017-2026 Smart code 203358507

import { createContext } from 'react';

export type FullscreenContextValue = readonly [
    fullscreen: boolean,
    // `target` defaults to document.documentElement (whole-app fullscreen, used by every
    // route's generic topbar button) - passing a specific element (e.g. the Player route's
    // own video+controls container) fullscreens just that element instead. Ignored when
    // running in the Electron shell, where fullscreen is a whole-window property with no
    // per-element equivalent.
    requestFullscreen: (target?: HTMLElement) => Promise<void> | void,
    exitFullscreen: () => void,
    toggleFullscreen: (target?: HTMLElement) => void,
    supported: boolean,
    setVideoElement: (el: HTMLVideoElement | null) => void,
];

const FullscreenContext = createContext<FullscreenContextValue | null>(null);

FullscreenContext.displayName = 'FullscreenContext';

export default FullscreenContext;
