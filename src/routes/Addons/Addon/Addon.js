// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('stremio/components/Icon');
const { Button, Image } = require('stremio/components');
const styles = require('./styles');

// A small, fixed palette of gradient pairs (matching the design mockup's hand-picked hub-card
// colors) so an addon without its own logo image gets a distinct, consistent color instead of a
// generic icon - same addon always gets the same color across renders/sessions, picked by a
// cheap deterministic hash over its id rather than at random.
const LOGO_GRADIENTS = [
    ['#FF7A45', '#FF3D2E'],
    ['#7C9EFF', '#3D5AFE'],
    ['#5CD6A9', '#1F9A6C'],
    ['#FFD166', '#E8A02C'],
    ['#C792EA', '#8657C4'],
    ['#4FD1E8', '#2A93A8'],
];

const gradientForId = (id) => {
    const key = typeof id === 'string' && id.length > 0 ? id : 'addon';
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    const [from, to] = LOGO_GRADIENTS[hash % LOGO_GRADIENTS.length];
    return `linear-gradient(135deg, ${from}, ${to})`;
};

const hostnameForUrl = (url) => {
    if (typeof url !== 'string' || url.length === 0) {
        return null;
    }

    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
};

const Addon = ({ className, id, name, version, logo, description, transportUrl, behaviorHints, installed, onInstall, onUninstall, onConfigure, onOpen, onShare, dataset }) => {
    const { t } = useTranslation();
    const displayName = typeof name === 'string' && name.length > 0 ? name : id;
    const source = React.useMemo(() => hostnameForUrl(transportUrl), [transportUrl]);
    const onInstallClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onInstall === 'function') {
            onInstall({
                type: 'install',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onInstall, dataset]);
    const onUninstallClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onUninstall === 'function') {
            onUninstall({
                type: 'uninstall',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onUninstall, dataset]);
    const onOpenClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onOpen === 'function') {
            onOpen({
                type: 'open',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onOpen, dataset]);
    const configureButtonOnClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onConfigure === 'function') {
            onConfigure({
                type: 'configure',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onConfigure, dataset]);
    const shareButtonOnClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onShare === 'function') {
            onShare({
                type: 'share',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onShare, dataset]);
    const onKeyDown = React.useCallback((event) => {
        if (event.key === 'Enter') {
            onOpenClick(event);
        }
    }, [onOpenClick]);
    const renderLogoFallback = React.useCallback(() => (
        <div className={styles['logo-letter']}>{displayName.charAt(0).toUpperCase()}</div>
    ), [displayName]);
    return (
        <Button className={classnames(className, styles['addon-container'])} onKeyDown={onKeyDown} onClick={onOpenClick}>
            <div className={styles['logo-container']} style={{ background: gradientForId(id) }}>
                <Image
                    className={styles['logo']}
                    src={logo}
                    alt={' '}
                    renderFallback={renderLogoFallback}
                />
            </div>
            <div className={styles['info-container']}>
                <div className={styles['name-row']}>
                    <div className={styles['name-container']} title={displayName}>{displayName}</div>
                    {
                        typeof version === 'string' && version.length > 0 ?
                            <div className={styles['version-container']} title={t('ADDON_VERSION_SHORT', {version})}>{t('ADDON_VERSION_SHORT', {version})}</div>
                            :
                            null
                    }
                </div>
                {
                    typeof description === 'string' && description.length > 0 ?
                        <div className={styles['description-container']} title={description}>{description}</div>
                        :
                        null
                }
                {
                    source !== null ?
                        <div className={styles['source-container']}>
                            <Icon className={styles['source-icon']} name={'globe'} />
                            {source}
                        </div>
                        :
                        null
                }
            </div>
            <div className={styles['buttons-container']}>
                {
                    !behaviorHints.configurationRequired && behaviorHints.configurable ?
                        <Button className={styles['configure-button-container']} title={t('ADDON_CONFIGURE')} tabIndex={-1} onClick={configureButtonOnClick}>
                            <Icon className={styles['icon']} name={'settings'} />
                            <div className={styles['label']}>{t('ADDON_CONFIGURE')}</div>
                        </Button>
                        :
                        null
                }
                <Button
                    className={installed ? styles['uninstall-button-container'] : styles['install-button-container']}
                    title={installed ? t('ADDON_UNINSTALL') : behaviorHints.configurationRequired ? t('ADDON_CONFIGURE') : t('ADDON_INSTALL')}
                    tabIndex={-1}
                    onClick={installed ? onUninstallClick : behaviorHints.configurationRequired ? configureButtonOnClick : onInstallClick}
                >
                    <div className={styles['label']}>{installed ? t('ADDON_UNINSTALL') : behaviorHints.configurationRequired ? t('ADDON_CONFIGURE') : t('ADDON_INSTALL')}</div>
                </Button>
                <Button className={styles['share-button-container']} title={t('SHARE_ADDON')} tabIndex={-1} onClick={shareButtonOnClick}>
                    <Icon className={styles['icon']} name={'share'} />
                </Button>
            </div>
        </Button>
    );
};

Addon.propTypes = {
    className: PropTypes.string,
    id: PropTypes.string,
    name: PropTypes.string,
    version: PropTypes.string,
    logo: PropTypes.string,
    description: PropTypes.string,
    transportUrl: PropTypes.string,
    types: PropTypes.arrayOf(PropTypes.string),
    behaviorHints: PropTypes.shape({
        adult: PropTypes.bool,
        configurable: PropTypes.bool,
        configurationRequired: PropTypes.bool,
        p2p: PropTypes.bool,
    }),
    installed: PropTypes.bool,
    onToggle: PropTypes.func,
    onInstall: PropTypes.func,
    onUninstall: PropTypes.func,
    onConfigure: PropTypes.func,
    onOpen: PropTypes.func,
    onShare: PropTypes.func,
    dataset: PropTypes.object
};

module.exports = Addon;
