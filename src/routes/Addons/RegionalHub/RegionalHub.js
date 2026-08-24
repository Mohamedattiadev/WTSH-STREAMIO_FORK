// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { useCore } = require('stremio/core');
const useInstalledAddonIds = require('stremio/common/useInstalledAddonIds');
const { AddonDetailsModal } = require('stremio/components');
const Addon = require('../Addon');
const { AddonPlaceholder } = require('../AddonPlaceholder');
const { REGIONAL_ADDONS } = require('../CONSTANTS');
const styles = require('./styles');

const REGION_ORDER = ['arabic', 'turkish', 'english', 'general'];

// Curated one-tap install hub for regional addons (see CONSTANTS.REGIONAL_ADDONS for the
// sourcing/legitimacy notes on each entry). Manifests are fetched client-side, live, from
// each addon's own transportUrl - the same approach as useAutoInstallEssentialAddons - so the
// hub always shows the addon's current name/logo/description rather than a stale copy.
const useRegionalManifests = () => {
    const [manifestsByUrl, setManifestsByUrl] = React.useState({});

    React.useEffect(() => {
        let cancelled = false;
        REGIONAL_ADDONS.forEach((addon) => {
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
    }, []);

    return manifestsByUrl;
};

const RegionalHub = ({ className }) => {
    const core = useCore();
    const installedIds = useInstalledAddonIds();
    const manifestsByUrl = useRegionalManifests();
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

    const groups = React.useMemo(() => {
        return REGION_ORDER
            .map((region) => ({
                region,
                label: REGIONAL_ADDONS.find((addon) => addon.region === region).regionLabel,
                addons: REGIONAL_ADDONS.filter((addon) => addon.region === region)
            }))
            .filter((group) => group.addons.length > 0);
    }, []);

    return (
        <div className={className}>
            {groups.map((group) => (
                <div key={group.region} className={styles['region-group']}>
                    <div className={styles['region-title']}>{group.label}</div>
                    <div className={styles['region-addons']}>
                        {group.addons.map((regional) => {
                            const manifest = manifestsByUrl[regional.transportUrl];
                            if (manifest === undefined) {
                                return <AddonPlaceholder key={regional.transportUrl} className={styles['addon']} />;
                            }

                            if (manifest === null) {
                                return null;
                            }

                            const installed = installedIds.has(manifest.id);
                            const description = regional.caveat
                                ? `${typeof manifest.description === 'string' ? manifest.description : ''} — ${regional.caveat}`.trim()
                                : manifest.description;
                            const addonDataset = { manifest, transportUrl: regional.transportUrl };
                            return (
                                <Addon
                                    key={regional.transportUrl}
                                    className={styles['addon']}
                                    id={manifest.id}
                                    name={manifest.name}
                                    version={manifest.version}
                                    logo={manifest.logo}
                                    description={description}
                                    types={manifest.types}
                                    behaviorHints={manifest.behaviorHints || {}}
                                    installed={installed}
                                    onInstall={onInstall}
                                    onUninstall={onUninstall}
                                    onConfigure={onConfigure}
                                    onOpen={onOpen}
                                    dataset={{ addon: addonDataset }}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
            {
                typeof detailsTransportUrl === 'string' ?
                    <AddonDetailsModal
                        transportUrl={detailsTransportUrl}
                        onCloseRequest={closeDetails}
                    />
                    :
                    null
            }
        </div>
    );
};

RegionalHub.propTypes = {
    className: PropTypes.string
};

module.exports = RegionalHub;
