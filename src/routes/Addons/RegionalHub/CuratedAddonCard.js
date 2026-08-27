// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const Addon = require('../Addon');
const { AddonPlaceholder } = require('../AddonPlaceholder');

// Renders one curated-list entry (RegionalHub or AddonHub) against its live-fetched manifest -
// a placeholder while the fetch is in flight, nothing at all if it came back null (the addon
// turned out to be dead/unreachable just now, so never show a card claiming otherwise).
const CuratedAddonCard = ({ className, curated, manifest, installed, onInstall, onUninstall, onConfigure, onOpen }) => {
    if (manifest === undefined) {
        return <AddonPlaceholder className={className} />;
    }

    if (manifest === null) {
        return null;
    }

    const description = curated.caveat
        ? `${typeof manifest.description === 'string' ? manifest.description : ''} — ${curated.caveat}`.trim()
        : manifest.description;
    const addonDataset = { manifest, transportUrl: curated.transportUrl };

    return (
        <Addon
            className={className}
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
};

CuratedAddonCard.propTypes = {
    className: PropTypes.string,
    curated: PropTypes.shape({
        transportUrl: PropTypes.string.isRequired,
        caveat: PropTypes.string
    }).isRequired,
    manifest: PropTypes.object,
    installed: PropTypes.bool,
    onInstall: PropTypes.func,
    onUninstall: PropTypes.func,
    onConfigure: PropTypes.func,
    onOpen: PropTypes.func
};

module.exports = CuratedAddonCard;
