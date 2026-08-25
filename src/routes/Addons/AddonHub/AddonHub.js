// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { AddonDetailsModal } = require('stremio/components');
const { REGIONAL_ADDONS } = require('../CONSTANTS');
const useAddonManifests = require('../RegionalHub/useAddonManifests');
const useAddonActions = require('../RegionalHub/useAddonActions');
const CuratedAddonCard = require('../RegionalHub/CuratedAddonCard');
const styles = require('./styles');

// Flat, ungrouped browse of every real curated addon in CONSTANTS.REGIONAL_ADDONS (the same
// live-verified data RegionalHub groups by language/region) - the mockup's "Hub" tab has no
// real aggregator API behind it to wire up (checked: no such service exists in this codebase
// or reachable from it), so this reuses the one real curated source already here rather than
// inventing addon names. autoInstall entries (legitimate-by-construction, no setup needed) are
// surfaced first since they're the safest one-tap picks; the rest keep their CONSTANTS order.
//
// installedIds comes from Addons.js - see RegionalHub.js's own comment for why this doesn't
// call useInstalledAddonIds() itself (it would clobber Addons.js's own concurrent subscription
// to the same shared core model on unmount).
const AddonHub = ({ className, installedIds }) => {
    const manifestsByUrl = useAddonManifests(REGIONAL_ADDONS);
    const { detailsTransportUrl, closeDetails, onInstall, onUninstall, onConfigure, onOpen } = useAddonActions();

    const orderedAddons = React.useMemo(() => {
        return [...REGIONAL_ADDONS].sort((a, b) => (b.autoInstall === true) - (a.autoInstall === true));
    }, []);

    return (
        <div className={className}>
            <div className={styles['addon-hub-grid']}>
                {orderedAddons.map((curated) => (
                    <CuratedAddonCard
                        key={curated.transportUrl}
                        className={styles['addon']}
                        curated={curated}
                        manifest={manifestsByUrl[curated.transportUrl]}
                        installed={typeof manifestsByUrl[curated.transportUrl]?.id === 'string' && installedIds.has(manifestsByUrl[curated.transportUrl].id)}
                        onInstall={onInstall}
                        onUninstall={onUninstall}
                        onConfigure={onConfigure}
                        onOpen={onOpen}
                    />
                ))}
            </div>
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

AddonHub.propTypes = {
    className: PropTypes.string,
    installedIds: PropTypes.instanceOf(Set)
};

module.exports = AddonHub;
