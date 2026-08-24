// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { useCore } = require('stremio/core');
const useInstalledAddonIds = require('./useInstalledAddonIds');
const useStreamingServer = require('./useStreamingServer');
const useToast = require('./Toast/useToast');
const { REGIONAL_ADDONS } = require('stremio/routes/Addons/CONSTANTS');

// Auto-installed on first run so a new user has something to watch without any manual addon setup.
// Deliberately limited to sources that are legitimate by construction and can never surface
// unlicensed streams: the user's own local files, genuinely public-domain films, ad-supported
// YouTube/Pluto TV, "where to watch" links into the user's existing subscriptions, and metadata
// (no streams at all). Verified against https://github.com/Stremio/stremio-official-addons (the
// official Stremio addon index) where applicable, or by hand for the REGIONAL_ADDONS entries -
// never add torrent/debrid/unvetted stream-ripping sources to this list. Addons that *do* surface
// unlicensed streams (ArabCity, Dizipal, Animo) are opt-in only, via routes/Addons/RegionalHub.
const ESSENTIAL_ADDONS = [
    { id: 'org.stremio.watchhub', transportUrl: 'https://watchhub.strem.io/manifest.json', requiresStreamingServer: false },
    { id: 'com.linvo.stremiochannels', transportUrl: 'https://v3-channels.strem.io/manifest.json', requiresStreamingServer: false },
    { id: 'org.stremio.pubdomainmovies', transportUrl: 'https://caching.stremio.net/publicdomainmovies.now.sh/manifest.json', requiresStreamingServer: false },
    { id: 'org.stremio.local', transportUrl: 'http://127.0.0.1:11470/local-addon/manifest.json', requiresStreamingServer: true },
    ...REGIONAL_ADDONS
        .filter((addon) => addon.autoInstall)
        .map((addon) => ({ id: addon.id, transportUrl: addon.transportUrl, requiresStreamingServer: false }))
];

const STORAGE_KEY = 'stremio-essential-addons-auto-install-v1';

const readHandled = () => {
    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
        return {};
    }
};

const markHandled = (id) => {
    try {
        const handled = readHandled();
        handled[id] = true;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(handled));
    } catch (_) {
        // localStorage unavailable (private mode, etc); will just retry next session
    }
};

// Silently installs the handful of legitimate default addons a fresh install is missing, once,
// so a new/non-technical user has real catalogs and playable sources without ever visiting the
// Addons screen. Each addon is only ever auto-installed once per browser - if the user removes
// one afterwards, it stays removed.
//
// Manifests are fetched directly (plain `fetch`) rather than through the core's `AddonDetails`
// model: that model is a single shared slot (one "currently open addon details" state), so
// firing it concurrently for multiple transport URLs makes every caller see whichever fetch
// resolved last. Fetching manifests ourselves avoids that collision entirely.
const useAutoInstallEssentialAddons = () => {
    const core = useCore();
    const toast = useToast();
    const streamingServer = useStreamingServer();
    const installedIds = useInstalledAddonIds();
    const streamingServerAvailable = streamingServer.settings !== null && streamingServer.settings.type !== 'Err';
    const runningRef = React.useRef(false);

    React.useEffect(() => {
        if (runningRef.current) {
            return;
        }

        const handled = readHandled();
        const pending = ESSENTIAL_ADDONS.filter((essential) => {
            if (handled[essential.id] || installedIds.has(essential.id)) {
                return false;
            }
            return !essential.requiresStreamingServer || streamingServerAvailable;
        });
        if (pending.length === 0) {
            return;
        }

        runningRef.current = true;
        (async () => {
            const installedNames = [];
            for (const essential of pending) {
                try {
                    const response = await fetch(essential.transportUrl);
                    if (!response.ok) {
                        continue;
                    }

                    const manifest = await response.json();
                    core.transport.dispatch({
                        action: 'Ctx',
                        args: {
                            action: 'InstallAddon',
                            args: { manifest, transportUrl: essential.transportUrl }
                        }
                    });
                    markHandled(essential.id);
                    installedNames.push(typeof manifest.name === 'string' ? manifest.name : essential.id);
                } catch (_) {
                    // Unreachable right now (offline, addon temporarily down, no local server) -
                    // not marked handled, so it's retried on the next visit.
                }
            }

            if (installedNames.length > 0) {
                toast.show({
                    type: 'success',
                    title: `Added ${installedNames.join(', ')} so you can start watching right away`,
                    timeout: 6000
                });
            }
            runningRef.current = false;
        })();
    }, [installedIds, streamingServerAvailable]);
};

module.exports = useAutoInstallEssentialAddons;
