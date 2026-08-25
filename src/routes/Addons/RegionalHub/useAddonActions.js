// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { useCore } = require('stremio/core');

// Install/uninstall/configure/open handlers shared between RegionalHub and AddonHub - both
// drive the same real Ctx install/uninstall actions the rest of the Addons page uses, keyed
// off the { manifest, transportUrl } dataset each curated Addon card carries.
const useAddonActions = () => {
    const core = useCore();
    const [detailsTransportUrl, setDetailsTransportUrl] = React.useState(null);
    const closeDetails = React.useCallback(() => {
        setDetailsTransportUrl(null);
    }, []);
    const onInstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: { action: 'InstallAddon', args: event.dataset.addon }
        });
    }, [core]);
    const onUninstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: { action: 'UninstallAddon', args: event.dataset.addon }
        });
    }, [core]);
    const onConfigure = React.useCallback((event) => {
        window.open(event.dataset.addon.transportUrl.replace('manifest.json', 'configure'), '_blank');
    }, []);
    const onOpen = React.useCallback((event) => {
        setDetailsTransportUrl(event.dataset.addon.transportUrl);
    }, []);

    return { detailsTransportUrl, closeDetails, onInstall, onUninstall, onConfigure, onOpen };
};

module.exports = useAddonActions;
