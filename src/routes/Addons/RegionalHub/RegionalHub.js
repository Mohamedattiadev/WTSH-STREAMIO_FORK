// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { AddonDetailsModal } = require('stremio/components');
const { REGIONAL_ADDONS } = require('../CONSTANTS');
const useAddonManifests = require('./useAddonManifests');
const useAddonActions = require('./useAddonActions');
const CuratedAddonCard = require('./CuratedAddonCard');
const styles = require('./styles');

const REGION_ORDER = ['arabic', 'turkish', 'spanish', 'hindi', 'korean', 'asian', 'anime', 'english', 'general'];

// Curated one-tap install hub for regional addons (see CONSTANTS.REGIONAL_ADDONS for the
// sourcing/legitimacy notes on each entry), grouped by language/region. See AddonHub for the
// flat, ungrouped "all curated picks" browsing view reachable from the Addons page's Hub tab.
//
// installedIds is passed down from Addons.js rather than fetched here via
// useInstalledAddonIds() - that hook's useModelState unconditionally Unloads its shared
// 'installed_addons' core model on unmount, which would clobber Addons.js's own concurrent
// subscription to the same model the moment this component unmounts (confirmed live: switching
// tabs away from Regional permanently stuck the My tab on a loading skeleton).
const RegionalHub = ({ className, installedIds }) => {
    const manifestsByUrl = useAddonManifests(REGIONAL_ADDONS);
    const { detailsTransportUrl, closeDetails, onInstall, onUninstall, onConfigure, onOpen } = useAddonActions();

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
                        {group.addons.map((regional) => (
                            <CuratedAddonCard
                                key={regional.transportUrl}
                                className={styles['addon']}
                                curated={regional}
                                manifest={manifestsByUrl[regional.transportUrl]}
                                installed={typeof manifestsByUrl[regional.transportUrl]?.id === 'string' && installedIds.has(manifestsByUrl[regional.transportUrl].id)}
                                onInstall={onInstall}
                                onUninstall={onUninstall}
                                onConfigure={onConfigure}
                                onOpen={onOpen}
                            />
                        ))}
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
    className: PropTypes.string,
    installedIds: PropTypes.instanceOf(Set)
};

module.exports = RegionalHub;
