// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const classnames = require('classnames');
const debounce = require('lodash.debounce');
const useTranslate = require('stremio/common/useTranslate');
const { useStreamingServer, useNotifications, withCoreSuspender, getVisibleChildrenRange, useProfile } = require('stremio/common');
const useAutoInstallEssentialAddons = require('stremio/common/useAutoInstallEssentialAddons');
const { ContinueWatchingItem, EventModal, MainNavBars, MetaItem, MetaRow } = require('stremio/components');
const useBoard = require('./useBoard');
const useContinueWatchingPreview = require('./useContinueWatchingPreview');
const Hero = require('./Hero');
const LocalizedChannels = require('./LocalizedChannels');
const ReviewsRow = require('./ReviewsRow');
const styles = require('./styles');
const { default: StreamingServerWarning } = require('./StreamingServerWarning');

const GENRE_LINK_CATEGORY = 'genres';

const extractGenres = (item) => {
    return Array.isArray(item.links) ?
        item.links
            .filter((link) => typeof link.category === 'string' && link.category.toLowerCase() === GENRE_LINK_CATEGORY && typeof link.name === 'string')
            .map((link) => link.name)
        :
        [];
};

const THRESHOLD = 5;

const Board = () => {
    const t = useTranslate();
    useAutoInstallEssentialAddons();
    const streamingServer = useStreamingServer();
    const continueWatchingPreview = useContinueWatchingPreview();
    const [board, loadBoardRows] = useBoard();
    const notifications = useNotifications();
    const profile = useProfile();
    const [activeHeroItem, setActiveHeroItem] = React.useState(null);
    const boardCatalogsOffset = continueWatchingPreview.items.length > 0 ? 1 : 0;
    const heroItems = React.useMemo(() => {
        const seenIds = new Set();
        const items = [];
        continueWatchingPreview.items.slice(0, 3).forEach((item) => {
            if (item && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                items.push({ item, resumable: true });
            }
        });
        const readyCatalog = board.catalogs.find((catalog) => catalog.content?.type === 'Ready' && catalog.content.content.length > 0);
        if (readyCatalog) {
            readyCatalog.content.content.forEach((item) => {
                if (items.length >= 5 || !item || seenIds.has(item.id)) {
                    return;
                }

                seenIds.add(item.id);
                items.push({ item, resumable: false });
            });
        }
        return items;
    }, [continueWatchingPreview.items, board.catalogs]);
    const recommendedItems = React.useMemo(() => {
        const genreCounts = new Map();
        continueWatchingPreview.items.forEach((item) => {
            extractGenres(item).forEach((genre) => {
                genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
            });
        });
        if (genreCounts.size === 0) {
            return [];
        }

        const topGenres = new Set(
            Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([genre]) => genre)
        );
        const seenIds = new Set(continueWatchingPreview.items.map((item) => item.id));
        const matches = [];
        board.catalogs.forEach((catalog) => {
            if (catalog.content?.type !== 'Ready') {
                return;
            }

            catalog.content.content.forEach((item) => {
                if (seenIds.has(item.id) || matches.length >= 10) {
                    return;
                }

                if (extractGenres(item).some((genre) => topGenres.has(genre))) {
                    seenIds.add(item.id);
                    matches.push(item);
                }
            });
        });
        return matches;
    }, [board.catalogs, continueWatchingPreview.items]);
    const scrollContainerRef = React.useRef();
    const showStreamingServerWarning = React.useMemo(() => {
        return streamingServer.settings !== null && streamingServer.settings.type === 'Err' && (
            isNaN(profile.settings.streamingServerWarningDismissed.getTime()) ||
            profile.settings.streamingServerWarningDismissed.getTime() < Date.now());
    }, [profile.settings, streamingServer.settings]);
    const onVisibleRangeChange = React.useCallback(() => {
        const range = getVisibleChildrenRange(scrollContainerRef.current);
        if (range === null) {
            return;
        }

        const start = Math.max(0, range.start - boardCatalogsOffset - THRESHOLD);
        const end = range.end - boardCatalogsOffset + THRESHOLD;
        if (end < start) {
            return;
        }

        loadBoardRows({ start, end });
    }, [boardCatalogsOffset]);
    const onScroll = React.useCallback(debounce(onVisibleRangeChange, 250), [onVisibleRangeChange]);
    React.useLayoutEffect(() => {
        onVisibleRangeChange();
    }, [board.catalogs, onVisibleRangeChange]);
    return (
        <div className={styles['board-container']}>
            <EventModal />
            <MainNavBars className={styles['board-content-container']} route={'board'}>
                <div ref={scrollContainerRef} className={styles['board-content']} onScroll={onScroll}>
                    {
                        heroItems.length > 0 ?
                            <Hero items={heroItems} onActiveItemChange={setActiveHeroItem} />
                            :
                            null
                    }
                    <ReviewsRow className={classnames(styles['board-row'], 'animation-fade-in')} item={activeHeroItem} />
                    <LocalizedChannels className={classnames(styles['board-row'], 'animation-fade-in')} />
                    {
                        continueWatchingPreview.items.length > 0 ?
                            <MetaRow
                                className={classnames(styles['board-row'], styles['continue-watching-row'], 'animation-fade-in')}
                                title={t.string('BOARD_CONTINUE_WATCHING')}
                                catalog={continueWatchingPreview}
                                itemComponent={ContinueWatchingItem}
                                notifications={notifications}
                            />
                            :
                            null
                    }
                    {
                        recommendedItems.length > 0 ?
                            <MetaRow
                                className={classnames(styles['board-row'], styles['board-row-poster'], 'animation-fade-in')}
                                title={'Recommended for You'}
                                catalog={{ items: recommendedItems }}
                                itemComponent={MetaItem}
                            />
                            :
                            null
                    }
                    {board.catalogs.map((catalog, index) => {
                        switch (catalog.content?.type) {
                            case 'Ready': {
                                return (
                                    <MetaRow
                                        key={index}
                                        className={classnames(styles['board-row'], styles[`board-row-${catalog.content.content[0].posterShape}`], 'animation-fade-in')}
                                        catalog={catalog}
                                        itemComponent={MetaItem}
                                    />
                                );
                            }
                            case 'Err': {
                                if (catalog.content.content !== 'EmptyContent') {
                                    return (
                                        <MetaRow
                                            key={index}
                                            className={classnames(styles['board-row'], 'animation-fade-in')}
                                            catalog={catalog}
                                            message={catalog.content.content}
                                        />
                                    );
                                }
                                return null;
                            }
                            default: {
                                return (
                                    <MetaRow.Placeholder
                                        key={index}
                                        className={classnames(styles['board-row'], styles['board-row-poster'], 'animation-fade-in')}
                                        catalog={catalog}
                                        title={t.catalogTitle(catalog)}
                                    />
                                );
                            }
                        }
                    })}
                </div>
            </MainNavBars>
            {
                showStreamingServerWarning ?
                    <StreamingServerWarning className={styles['board-warning-container']} />
                    :
                    null
            }
        </div>
    );
};

const BoardFallback = () => (
    <div className={styles['board-container']}>
        <MainNavBars className={styles['board-content-container']} route={'board'} />
    </div>
);

module.exports = withCoreSuspender(Board, BoardFallback);
