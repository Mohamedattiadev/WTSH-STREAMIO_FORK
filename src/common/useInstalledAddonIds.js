// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const useModelState = require('./useModelState');

// Set of manifest ids currently installed, shared by anything that needs to know
// whether to offer install/uninstall for a given addon (auto-install, regional hub, etc).
const useInstalledAddonIds = () => {
    const action = React.useMemo(() => ({
        action: 'Load',
        args: { model: 'InstalledAddonsWithFilters', args: { request: { type: null } } }
    }), []);
    const installedAddons = useModelState({ model: 'installed_addons', action });
    return React.useMemo(() => {
        return new Set(
            (Array.isArray(installedAddons.catalog) ? installedAddons.catalog : [])
                .map((addon) => addon.manifest && addon.manifest.id)
                .filter((id) => typeof id === 'string')
        );
    }, [installedAddons.catalog]);
};

module.exports = useInstalledAddonIds;
