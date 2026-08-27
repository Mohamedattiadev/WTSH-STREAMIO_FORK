// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');

// Fetches each addon's own live manifest.json client-side (same approach as
// useAutoInstallEssentialAddons) so a curated install list always shows the addon's current
// name/logo/description rather than a stale copy baked into CONSTANTS.js. Shared between
// RegionalHub (grouped by region) and AddonHub (flat, all curated picks) so both stay backed by
// the exact same real, live-verified data in CONSTANTS.REGIONAL_ADDONS.
const useAddonManifests = (addons) => {
    const [manifestsByUrl, setManifestsByUrl] = React.useState({});

    React.useEffect(() => {
        let cancelled = false;
        addons.forEach((addon) => {
            fetch(addon.transportUrl)
                .then((response) => response.ok ? response.json() : Promise.reject(new Error('bad response')))
                .then((manifest) => {
                    if (!cancelled) {
                        setManifestsByUrl((prev) => ({ ...prev, [addon.transportUrl]: manifest }));
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setManifestsByUrl((prev) => ({ ...prev, [addon.transportUrl]: null }));
                    }
                });
        });
        return () => {
            cancelled = true;
        };
    }, [addons]);

    return manifestsByUrl;
};

module.exports = useAddonManifests;
