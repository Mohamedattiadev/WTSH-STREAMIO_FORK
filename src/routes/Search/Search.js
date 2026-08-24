// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const classnames = require('classnames');
const useTranslate = require('stremio/common/useTranslate');
const { default: Icon } = require('stremio/components/Icon');
const { useCore } = require('stremio/core');
const { withCoreSuspender } = require('stremio/common');
const { Button, Image, MainNavBars, MetaItem } = require('stremio/components');
const useSearch = require('./useSearch');
const useRemoteAddons = require('stremio/routes/Addons/useRemoteAddons');
const { COMMUNITY_ADDON_CATALOG } = require('stremio/routes/Addons/CONSTANTS');
const styles = require('./styles');
const { useSearchParams } = require('react-router-dom');

const addonSupportsSearch = (addon) => {
    return Array.isArray(addon.manifest.catalogs) && addon.manifest.catalogs.some((catalog) => (
        Array.isArray(catalog.extra) && catalog.extra.some((extra) => extra.name === 'search')
    ));
};

const matchRank = (name, query) => {
    if (typeof name !== 'string') {
        return 3;
    }

    const normalizedName = name.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    if (normalizedName === normalizedQuery) {
        return 0;
    }

    if (normalizedName.startsWith(normalizedQuery)) {
        return 1;
    }

    if (normalizedName.includes(normalizedQuery)) {
        return 2;
    }

    return 3;
};

const Search = () => {
    const [queryParams] = useSearchParams();
    const t = useTranslate();
    const core = useCore();
    const [search] = useSearch(queryParams);
    const communityAddons = useRemoteAddons(COMMUNITY_ADDON_CATALOG);
    const suggestedAddons = React.useMemo(() => {
        if (communityAddons.catalog?.content?.type !== 'Ready') {
            return [];
        }

        return communityAddons.catalog.content.content
            .filter((addon) => !addon.installed && addonSupportsSearch(addon))
            .slice(0, 4);
    }, [communityAddons.catalog]);
    const installSuggestedAddon = React.useCallback((addon) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: addon
            }
        });
    }, [core]);
    const query = React.useMemo(() => {
        return search.selected !== null ?
            search.selected.extra.reduceRight((query, [name, value]) => {
                if (name === 'search') {
                    return value;
                }

                return query;
            }, null)
            :
            null;
    }, [search.selected]);
    const results = React.useMemo(() => {
        if (query === null) {
            return [];
        }

        const items = search.catalogs
            .filter((catalog) => catalog.content?.type === 'Ready')
            .flatMap((catalog) => catalog.content.content.map((item) => ({
                ...item,
                sourceLabel: catalog.label ?? catalog.name ?? null
            })));
        return items
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const rankDiff = matchRank(a.item.name, query) - matchRank(b.item.name, query);
                return rankDiff !== 0 ? rankDiff : a.index - b.index;
            })
            .map(({ item }) => item);
    }, [search.catalogs, query]);
    const isLoading = React.useMemo(() => {
        // Anything that hasn't resolved to Ready/Err yet is still in flight -
        // treated as loading so the grid never renders a blank gap while
        // catalogs are still being requested.
        return search.catalogs.some((catalog) => catalog.content?.type !== 'Ready' && catalog.content?.type !== 'Err');
    }, [search.catalogs]);
    const failedSourceCount = React.useMemo(() => {
        return search.catalogs.filter((catalog) => catalog.content?.type === 'Err' && catalog.content.content !== 'EmptyContent').length;
    }, [search.catalogs]);
    return (
        <MainNavBars className={styles['search-container']} route={'search'} query={query}>
            <div className={styles['search-content']}>
                {
                    query === null ?
                        <div className={classnames(styles['search-hints-wrapper'])}>
                            <div className={classnames(styles['search-hints-title-container'], 'animation-fade-in')}>
                                <div className={styles['search-hints-title']}>{t.string('SEARCH_ANYTHING')}</div>
                            </div>
                            <div className={classnames(styles['search-hints-container'], 'animation-fade-in')}>
                                <div className={styles['search-hint-container']}>
                                    <Icon className={styles['icon']} name={'trailer'} />
                                    <div className={styles['label']}>{t.string('SEARCH_CATEGORIES')}</div>
                                </div>
                                <div className={styles['search-hint-container']}>
                                    <Icon className={styles['icon']} name={'actors'} />
                                    <div className={styles['label']}>{t.string('SEARCH_PERSONS')}</div>
                                </div>
                                <div className={styles['search-hint-container']}>
                                    <Icon className={styles['icon']} name={'link'} />
                                    <div className={styles['label']}>{t.string('SEARCH_PROTOCOLS')}</div>
                                </div>
                                <div className={styles['search-hint-container']}>
                                    <Icon className={styles['icon']} name={'imdb-outline'} />
                                    <div className={styles['label']}>{t.string('SEARCH_TYPES')}</div>
                                </div>
                            </div>
                        </div>
                        :
                        search.catalogs.length === 0 ?
                            <div className={styles['message-container']}>
                                <Image
                                    className={styles['image']}
                                    src={require('/assets/images/empty.png')}
                                    alt={' '}
                                />
                                <div className={styles['message-label']}>{ t.string('STREMIO_TV_SEARCH_NO_ADDONS') }</div>
                            </div>
                            :
                            results.length > 0 ?
                                <React.Fragment>
                                    {
                                        failedSourceCount > 0 ?
                                            <div className={styles['search-warning']}>
                                                {failedSourceCount} source{failedSourceCount === 1 ? '' : 's'} didn&apos;t respond - some results may be missing
                                            </div>
                                            :
                                            null
                                    }
                                    <div className={classnames(styles['search-results-grid'], 'animation-fade-in')}>
                                        {results.map((item) => (
                                            <MetaItem
                                                key={`${item.sourceLabel}-${item.type}-${item.id}`}
                                                type={item.type}
                                                name={item.name}
                                                poster={item.poster}
                                                posterShape={item.posterShape}
                                                deepLinks={item.deepLinks}
                                                trailerStreams={item.trailerStreams}
                                                releaseInfo={item.releaseInfo}
                                                badgeLabel={item.sourceLabel}
                                            />
                                        ))}
                                        {suggestedAddons.map((addon) => (
                                            <Button
                                                key={addon.transportUrl}
                                                className={styles['install-suggestion']}
                                                title={`Install ${addon.manifest.name}`}
                                                onClick={() => installSuggestedAddon(addon)}
                                            >
                                                <Icon className={styles['icon']} name={'add'} />
                                                <div className={styles['label']}>Install {addon.manifest.name}</div>
                                                <div className={styles['sublabel']}>for more results</div>
                                            </Button>
                                        ))}
                                    </div>
                                </React.Fragment>
                                :
                                isLoading ?
                                    <div className={classnames(styles['search-results-grid'], 'animation-fade-in')}>
                                        {Array.from({ length: 10 }).map((_, index) => (
                                            <div key={index} className={styles['meta-item-placeholder']}>
                                                <div className={styles['poster-container']} />
                                                <div className={styles['title-bar-container']}>
                                                    <div className={styles['title-label']} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    :
                                    <div className={styles['message-container']}>
                                        <Image
                                            className={styles['image']}
                                            src={require('/assets/images/empty.png')}
                                            alt={' '}
                                        />
                                        <div className={styles['message-label']}>No results found for &quot;{query}&quot;</div>
                                    </div>
                }
            </div>
        </MainNavBars>
    );
};

const SearchFallback = () => {
    const [queryParams] = useSearchParams();
    return <MainNavBars className={styles['search-container']} route={'search'} query={queryParams.get('search') ?? queryParams.get('query')} />;
};

module.exports = withCoreSuspender(Search, SearchFallback);
