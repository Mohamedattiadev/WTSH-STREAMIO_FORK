// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useParams, useNavigate } = require('react-router');
const { useSearchParams } = require('react-router-dom');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('stremio/components/Icon');
const { useCore } = require('stremio/core');
const { usePlatform, useBinaryState, withCoreSuspender } = require('stremio/common');
const { default: HorizontalScroll } = require('stremio/components/HorizontalScroll');
const { AddonDetailsModal, Button, Image, MainNavBars, ModalDialog, SearchBar, SharePrompt, TextInput, MultiselectMenu } = require('stremio/components');
const useToast = require('stremio/common/Toast/useToast');
const Addon = require('./Addon');
const useInstalledAddons = require('./useInstalledAddons');
const useRemoteAddons = require('./useRemoteAddons');
const useAddonDetailsTransportUrl = require('./useAddonDetailsTransportUrl');
const useSelectableInputs = require('./useSelectableInputs');
const styles = require('./styles');
const { AddonPlaceholder } = require('./AddonPlaceholder');
const RegionalHub = require('./RegionalHub');
const AddonHub = require('./AddonHub');
const PersonalAddons = require('./PersonalAddons');
const StreamingSetup = require('./StreamingSetup');
const useAddonManifests = require('./RegionalHub/useAddonManifests');
const useAddonActions = require('./RegionalHub/useAddonActions');
const CuratedAddonCard = require('./RegionalHub/CuratedAddonCard');
const { OFFICIAL_ADDON_CATALOG, COMMUNITY_ADDON_CATALOG, REGIONAL_ADDONS } = require('./CONSTANTS');

// A handful of the safest one-tap picks (autoInstall: true - legitimate by construction, no
// setup needed) surfaced directly on the My tab, matching the mockup's "From the Addon Hub"
// featured strip - picked deterministically (first N autoInstall entries in CONSTANTS' own
// order) rather than a hand-curated "best of" list, so this never drifts into opinion/fabrication.
const FEATURED_HUB_ADDONS = REGIONAL_ADDONS.filter((addon) => addon.autoInstall === true).slice(0, 6);

const Addons = () => {
    const { type, transportUrl, catalogId } = useParams();
    const [queryParams] = useSearchParams();
    const urlParams = React.useMemo(() => ({
        type,
        transportUrl,
        catalogId
    }), [type, transportUrl, catalogId]);
    const { t } = useTranslation();
    const platform = usePlatform();
    const core = useCore();
    const navigate = useNavigate();
    const toast = useToast();
    const installedAddons = useInstalledAddons(urlParams);
    const remoteAddons = useRemoteAddons(urlParams);
    const goToInstalledAddons = React.useCallback(() => {
        setRegionalHubOpen(false);
        setHubOpen(false);
        navigate('/addons');
    }, [navigate]);
    const goToCatalog = React.useCallback((catalog) => {
        const { type, transportUrl, catalogId } = catalog;
        navigate(`/addons/${type}/${encodeURIComponent(transportUrl)}/${catalogId}`);
    }, [navigate]);
    const goToOfficialAddons = React.useCallback(() => {
        goToCatalog(OFFICIAL_ADDON_CATALOG);
    }, [goToCatalog]);
    const goToCommunityAddons = React.useCallback(() => {
        goToCatalog(COMMUNITY_ADDON_CATALOG);
    }, [goToCatalog]);
    const [regionalHubOpen, setRegionalHubOpen] = React.useState(false);
    const [hubOpen, setHubOpen] = React.useState(false);
    const goToRegionalHub = React.useCallback(() => {
        setRegionalHubOpen(true);
        setHubOpen(false);
    }, []);
    const goToHub = React.useCallback(() => {
        setHubOpen(true);
        setRegionalHubOpen(false);
    }, []);
    const featuredManifestsByUrl = useAddonManifests(FEATURED_HUB_ADDONS);
    const featuredActions = useAddonActions();
    // Derived from installedAddons.catalog (already fetched below via useInstalledAddons)
    // rather than a separate useInstalledAddonIds() subscription - useModelState (see
    // src/common/useModelState.js) unconditionally dispatches an Unload for its model name on
    // unmount, and RegionalHub/AddonHub each already subscribe to this same shared
    // 'installed_addons' core model via that hook. Confirmed live: fixing the tab-highlight
    // bug below (so Regional/Hub properly unmount when switching to My) meant that unmount's
    // Unload was clobbering this component's own installedAddons state, permanently stuck on
    // the loading skeleton. A second independent subscription here would hit the exact same
    // hazard, so this reuses the data already being fetched instead of opening another one.
    const installedAddonIds = React.useMemo(() => {
        return new Set(
            installedAddons.catalog
                .map((addon) => addon.manifest && addon.manifest.id)
                .filter((id) => typeof id === 'string')
        );
    }, [installedAddons.catalog]);
    // Derived straight from the URL/local UI state (never from installedAddons.selected or
    // remoteAddons.selected) so exactly one tab is ever active by construction. Both of those
    // model states only update once their async Load/Unload round-trips the core worker -
    // deriving "My"'s highlight from installedAddons.selected in particular meant that right
    // after switching to Official/Community, the URL (and the new tab's own highlight) had
    // already changed while the old My-tab model state hadn't cleared yet, so both showed
    // active for a frame. isOfficialTab/isCommunityTab now compare urlParams.catalogId directly
    // against the same two constants goToOfficialAddons/goToCommunityAddons navigate to.
    // Regional/Hub are local UI toggles, not routes (goToRegionalHub/goToHub never navigate) -
    // without these two also excluding them, opening Regional/Hub while already on the
    // Official/Community route left that catalog tab's own highlight on too, since urlParams
    // itself never changes underneath it.
    const isMyTab = typeof urlParams.transportUrl !== 'string' && !regionalHubOpen && !hubOpen;
    const isOfficialTab = urlParams.catalogId === OFFICIAL_ADDON_CATALOG.catalogId && !regionalHubOpen && !hubOpen;
    const isCommunityTab = urlParams.catalogId === COMMUNITY_ADDON_CATALOG.catalogId && !regionalHubOpen && !hubOpen;
    const [addonDetailsTransportUrl, setAddonDetailsTransportUrl] = useAddonDetailsTransportUrl(urlParams);
    const selectInputs = useSelectableInputs(installedAddons, remoteAddons);
    const [filtersModalOpen, openFiltersModal, closeFiltersModal] = useBinaryState(false);
    const [addAddonModalOpen, openAddAddonModal, closeAddAddonModal] = useBinaryState(false);
    const addAddonUrlInputRef = React.useRef(null);
    const addAddonOnSubmit = React.useCallback(() => {
        if (addAddonUrlInputRef.current !== null) {
            try {
                let url = new URL(addAddonUrlInputRef.current.value).toString();
                setAddonDetailsTransportUrl(url);
            } catch (e) {
                toast.show({
                    type: 'error',
                    title: `Failed to parse addon url: ${addAddonUrlInputRef.current.value}`,
                    timeout: 10000
                });
                console.error('Failed to parse addon url:', e);
            }
        }
    }, [setAddonDetailsTransportUrl]);
    const addAddonModalButtons = React.useMemo(() => {
        return [
            {
                className: styles['cancel-button'],
                label: t('BUTTON_CANCEL'),
                props: {
                    onClick: closeAddAddonModal
                }
            },
            {
                label: t('ADDON_ADD'),
                props: {
                    onClick: addAddonOnSubmit
                }
            }
        ];
    }, [addAddonOnSubmit]);
    const [search, setSearch] = React.useState('');
    const searchInputOnChange = React.useCallback((event) => {
        setSearch(event.currentTarget.value);
    }, []);
    const [sharedAddon, setSharedAddon] = React.useState(null);
    const clearSharedAddon = React.useCallback(() => {
        setSharedAddon(null);
    }, []);
    const onAddonShare = React.useCallback((event) => {
        setSharedAddon(event.dataset.addon);
    }, []);
    const onAddonInstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: event.dataset.addon,
            }
        });
    }, []);
    const onAddonUninstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UninstallAddon',
                args: event.dataset.addon,
            }
        });
    }, []);
    const onAddonConfigure = React.useCallback((event) => {
        platform.openExternal(event.dataset.addon.transportUrl.replace('manifest.json', 'configure'));
    }, []);
    const onAddonOpen = React.useCallback((event) => {
        setAddonDetailsTransportUrl(event.dataset.addon.transportUrl);
    }, [setAddonDetailsTransportUrl]);
    const closeAddonDetails = React.useCallback(() => {
        setAddonDetailsTransportUrl(null);
    }, [setAddonDetailsTransportUrl]);
    const searchFilterPredicate = React.useCallback((addon) => {
        return search.length === 0 ||
            (
                (typeof addon.manifest.name === 'string' && addon.manifest.name.toLowerCase().includes(search.toLowerCase())) ||
                (typeof addon.manifest.description === 'string' && addon.manifest.description.toLowerCase().includes(search.toLowerCase()))
            );
    }, [search]);
    const renderLogoFallback = React.useCallback(() => (
        <Icon className={styles['icon']} name={'addons'} />
    ), []);
    React.useLayoutEffect(() => {
        closeAddAddonModal();
        setSearch('');
        clearSharedAddon();
        setRegionalHubOpen(false);
        setHubOpen(false);
    }, [urlParams, queryParams]);
    return (
        <MainNavBars className={styles['addons-container']} route={'addons'}>
            <div className={styles['addons-content']}>
                <div className={styles['tabs-container']}>
                    <Button className={classnames(styles['tab'], { [styles['selected']]: isMyTab })} title={t('ADDON_MY')} onClick={goToInstalledAddons}>
                        <div className={styles['label']}>{t('ADDON_MY')}</div>
                        {
                            installedAddons.selected !== null ?
                                <div className={styles['tab-count']}>{installedAddons.catalog.length}</div>
                                :
                                null
                        }
                    </Button>
                    <Button className={classnames(styles['tab'], { [styles['selected']]: isOfficialTab })} title={t('ADDON_OFFICIAL')} onClick={goToOfficialAddons}>
                        <div className={styles['label']}>{t('ADDON_OFFICIAL')}</div>
                        {
                            isOfficialTab && remoteAddons.catalog?.content?.type === 'Ready' ?
                                <div className={styles['tab-count']}>{remoteAddons.catalog.content.content.length}</div>
                                :
                                null
                        }
                    </Button>
                    <Button className={classnames(styles['tab'], { [styles['selected']]: isCommunityTab })} title={t('ADDON_COMMUNITY')} onClick={goToCommunityAddons}>
                        <div className={styles['label']}>{t('ADDON_COMMUNITY')}</div>
                        {
                            isCommunityTab && remoteAddons.catalog?.content?.type === 'Ready' ?
                                <div className={styles['tab-count']}>{remoteAddons.catalog.content.content.length}</div>
                                :
                                null
                        }
                    </Button>
                    <Button className={classnames(styles['tab'], { [styles['selected']]: regionalHubOpen })} title={'Regional'} onClick={goToRegionalHub}>
                        <div className={styles['label']}>{'Regional'}</div>
                    </Button>
                    <Button className={classnames(styles['tab'], { [styles['selected']]: hubOpen })} title={'Hub'} onClick={goToHub}>
                        <div className={styles['label']}>{'Hub'}</div>
                    </Button>
                </div>
                {
                    regionalHubOpen || hubOpen ?
                        null
                        :
                        <div className={styles['selectable-inputs-container']}>
                            {selectInputs.map((selectInput, index) => (
                                <MultiselectMenu
                                    {...selectInput}
                                    key={index}
                                    className={styles['select-input-container']}
                                />
                            ))}
                            <SearchBar
                                className={styles['search-bar']}
                                title={t('ADDON_SEARCH')}
                                value={search}
                                onChange={searchInputOnChange}
                            />
                            <Button className={styles['filter-button']} title={t('ALL_FILTERS')} onClick={openFiltersModal}>
                                <Icon className={styles['filter-icon']} name={'filters'} />
                                <div className={styles['filter-label']}>{t('ALL_FILTERS')}</div>
                            </Button>
                            <Button className={styles['add-button-container']} title={t('ADD_ADDON')} onClick={openAddAddonModal}>
                                <Icon className={styles['icon']} name={'add'} />
                                <div className={styles['add-button-label']}>{t('ADD_ADDON')}</div>
                            </Button>
                        </div>
                }
                <div className={styles['addons-scroll']}>
                    {
                        isMyTab ?
                            <React.Fragment>
                                <StreamingSetup className={styles['personal-addons-container']} installedIds={installedAddonIds} />
                                <PersonalAddons className={styles['personal-addons-container']} />
                            </React.Fragment>
                            :
                            null
                    }
                    {
                        !regionalHubOpen && !hubOpen && installedAddons.selected !== null && FEATURED_HUB_ADDONS.length > 0 ?
                            <div className={styles['featured-hub-strip']}>
                                <div className={styles['featured-hub-head']}>
                                    <div className={styles['featured-hub-title']}>{'From the Addon Hub'}</div>
                                    <Button className={styles['featured-hub-see-all']} title={'Hub'} onClick={goToHub}>
                                        {'See all'}
                                    </Button>
                                </div>
                                <HorizontalScroll className={styles['featured-hub-scroll']}>
                                    {FEATURED_HUB_ADDONS.map((curated) => (
                                        <CuratedAddonCard
                                            key={curated.transportUrl}
                                            className={styles['featured-hub-addon']}
                                            curated={curated}
                                            manifest={featuredManifestsByUrl[curated.transportUrl]}
                                            installed={typeof featuredManifestsByUrl[curated.transportUrl]?.id === 'string' && installedAddonIds.has(featuredManifestsByUrl[curated.transportUrl].id)}
                                            onInstall={featuredActions.onInstall}
                                            onUninstall={featuredActions.onUninstall}
                                            onConfigure={featuredActions.onConfigure}
                                            onOpen={featuredActions.onOpen}
                                        />
                                    ))}
                                </HorizontalScroll>
                                {
                                    typeof featuredActions.detailsTransportUrl === 'string' ?
                                        <AddonDetailsModal
                                            transportUrl={featuredActions.detailsTransportUrl}
                                            onCloseRequest={featuredActions.closeDetails}
                                        />
                                        :
                                        null
                                }
                            </div>
                            :
                            null
                    }
                    {
                        regionalHubOpen ?
                            <RegionalHub className={styles['addons-list-container']} installedIds={installedAddonIds} />
                            :
                            hubOpen ?
                                <AddonHub className={styles['addons-list-container']} installedIds={installedAddonIds} />
                                :
                                installedAddons.selected !== null ?
                                    installedAddons.selectable.types.length === 0 ?
                                        <div className={styles['message-container']}>
                                            {t('NO_ADDONS')}
                                        </div>
                                        :
                                        installedAddons.catalog.length === 0 ?
                                            <div className={styles['message-container']}>
                                                {t('NO_ADDONS_FOR_TYPE')}
                                            </div>
                                            :
                                            <div className={styles['addons-list-container']}>
                                                {
                                                    installedAddons.catalog
                                                        .filter(searchFilterPredicate)
                                                        .map((addon, index) => (
                                                            <Addon
                                                                key={index}
                                                                className={classnames(styles['addon'], 'animation-fade-in')}
                                                                id={addon.manifest.id}
                                                                name={addon.manifest.name}
                                                                version={addon.manifest.version}
                                                                logo={addon.manifest.logo}
                                                                transportUrl={addon.transportUrl}
                                                                description={addon.manifest.description}
                                                                types={addon.manifest.types}
                                                                behaviorHints={addon.manifest.behaviorHints}
                                                                installed={addon.installed}
                                                                onInstall={onAddonInstall}
                                                                onUninstall={onAddonUninstall}
                                                                onConfigure={onAddonConfigure}
                                                                onOpen={onAddonOpen}
                                                                onShare={onAddonShare}
                                                                dataset={{ addon }}
                                                            />
                                                        ))
                                                }
                                            </div>
                                    :
                                    remoteAddons.selected !== null ?
                                        remoteAddons.catalog.content.type === 'Err' ?
                                            <div className={styles['message-container']}>
                                                {remoteAddons.catalog.content.content}
                                            </div>
                                            :
                                            remoteAddons.catalog.content.type === 'Loading' ?
                                                <div className={styles['addons-list-container']}>
                                                    {Array.from({ length: 6 }).map((_, index) => (
                                                        <AddonPlaceholder key={index} className={styles['addon']} />
                                                    ))}
                                                </div>
                                                :
                                                <div className={styles['addons-list-container']}>
                                                    {
                                                        remoteAddons.catalog.content.content
                                                            .filter(searchFilterPredicate)
                                                            .map((addon, index) => (
                                                                <Addon
                                                                    key={index}
                                                                    className={classnames(styles['addon'], 'animation-fade-in')}
                                                                    id={addon.manifest.id}
                                                                    name={addon.manifest.name}
                                                                    version={addon.manifest.version}
                                                                    logo={addon.manifest.logo}
                                                                    transportUrl={addon.transportUrl}
                                                                    description={addon.manifest.description}
                                                                    types={addon.manifest.types}
                                                                    behaviorHints={addon.manifest.behaviorHints}
                                                                    installed={addon.installed}
                                                                    onInstall={onAddonInstall}
                                                                    onUninstall={onAddonUninstall}
                                                                    onConfigure={onAddonConfigure}
                                                                    onOpen={onAddonOpen}
                                                                    onShare={onAddonShare}
                                                                    dataset={{ addon }}
                                                                />
                                                            ))
                                                    }
                                                </div>
                                        :
                                        <div className={styles['addons-list-container']}>
                                            {Array.from({ length: 6 }).map((_, index) => (
                                                <AddonPlaceholder key={index} className={styles['addon']} />
                                            ))}
                                        </div>
                    }
                </div>
            </div>
            {
                filtersModalOpen ?
                    <ModalDialog title={t('ADDONS_FILTERS')} className={styles['filters-modal']} onCloseRequest={closeFiltersModal}>
                        {selectInputs.map((selectInput, index) => (
                            <MultiselectMenu
                                {...selectInput}
                                key={index}
                                className={styles['select-input-container']}
                            />
                        ))}
                    </ModalDialog>
                    :
                    null
            }
            {
                addAddonModalOpen ?
                    <ModalDialog
                        className={styles['add-addon-modal-container']}
                        title={t('ADD_ADDON')}
                        buttons={addAddonModalButtons}
                        onCloseRequest={closeAddAddonModal}>
                        <div className={styles['notice']}>{t('ADD_ADDON_DESCRIPTION')}</div>
                        <TextInput
                            ref={addAddonUrlInputRef}
                            className={styles['addon-url-input']}
                            type={'text'}
                            placeholder={t('PASTE_ADDON_URL')}
                            autoFocus={true}
                            onSubmit={addAddonOnSubmit}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                sharedAddon !== null ?
                    <ModalDialog
                        className={styles['share-modal-container']}
                        title={t('SHARE_ADDON')}
                        onCloseRequest={clearSharedAddon}>
                        <div className={styles['title-container']}>
                            <Image
                                className={styles['logo']}
                                src={sharedAddon.manifest.logo}
                                alt={' '}
                                renderFallback={renderLogoFallback}
                            />
                            <div className={styles['name-container']}>
                                <span className={styles['name']}>{typeof sharedAddon.manifest.name === 'string' && sharedAddon.manifest.name.length > 0 ? sharedAddon.manifest.name : sharedAddon.manifest.id}</span>
                                {
                                    typeof sharedAddon.manifest.version === 'string' && sharedAddon.manifest.version.length > 0 ?
                                        <span className={styles['version']}>{t('ADDON_VERSION_SHORT', { version: sharedAddon.manifest.version })}</span>
                                        :
                                        null
                                }
                            </div>
                        </div>
                        <SharePrompt
                            className={styles['share-prompt-container']}
                            url={sharedAddon.transportUrl}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                typeof addonDetailsTransportUrl === 'string' ?
                    <AddonDetailsModal
                        transportUrl={addonDetailsTransportUrl}
                        onCloseRequest={closeAddonDetails}
                    />
                    :
                    null
            }
        </MainNavBars>
    );
};

const AddonsFallback = () => (
    <MainNavBars className={styles['addons-container']} route={'addons'} />
);

module.exports = withCoreSuspender(Addons, AddonsFallback);
