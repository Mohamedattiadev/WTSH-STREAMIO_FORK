// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useCore } = require('stremio/core');
const useModelState = require('stremio/common/useModelState');

const useSearch = (queryParams) => {
    const core = useCore();
    // TODO: refactor this to be in stremio-core-web
    // React.useEffect(() => {
    //     let timerId = setTimeout(emitSearchEvent, 500);
    //     function emitSearchEvent() {
    //         timerId = null;
    //         const state = core.transport.getState('search');
    //         if (state.selected !== null) {
    //             const [, query] = state.selected.extra.find(([name]) => name === 'search');
    //             const responses = state.catalogs.filter((catalog) => catalog.content?.type === 'Ready');
    //             core.transport.analytics({
    //                 event: 'Search',
    //                 args: {
    //                     query,
    //                     responsesCount: responses.length
    //                 }
    //             });
    //         }
    //     }
    //     return () => {
    //         if (timerId !== null) {
    //             clearTimeout(timerId);
    //             emitSearchEvent();
    //         }
    //     };
    // }, [queryParams.get('search')]);
    const action = React.useMemo(() => {
        const query = queryParams.get('search') ?? queryParams.get('query');
        if (query?.length > 0) {
            return {
                action: 'Load',
                args: {
                    model: 'CatalogsWithExtra',
                    args: {
                        extra: [
                            ['search', query]
                        ]
                    }
                }
            };
        } else {
            return {
                action: 'Unload'
            };
        }
    }, [queryParams]);
    const loadRange = React.useCallback((range) => {
        core.transport.dispatch({
            action: 'CatalogsWithExtra',
            args: {
                action: 'LoadRange',
                args: range
            }
        }, 'search');
    }, []);
    const search = useModelState({ model: 'search', action });
    // Merged results grid needs every catalog's response eventually, but firing
    // all of them at once floods the browser's per-host connection limit and
    // causes addons to time out (their results then silently disappear) - so
    // pull in a bounded number at a time and request more as slots free up.
    const loadedUpToRef = React.useRef(0);
    React.useEffect(() => {
        loadedUpToRef.current = 0;
    }, [search.selected]);
    React.useEffect(() => {
        const BATCH_SIZE = 6;
        if (search.catalogs.length === 0 || loadedUpToRef.current >= search.catalogs.length) {
            return;
        }

        const inFlightCount = search.catalogs.filter((catalog) => catalog.content?.type === 'Loading').length;
        const freeSlots = BATCH_SIZE - inFlightCount;
        if (freeSlots <= 0) {
            return;
        }

        const start = loadedUpToRef.current;
        const end = Math.min(start + freeSlots, search.catalogs.length) - 1;
        loadedUpToRef.current = end + 1;
        loadRange({ start, end });
    }, [search.catalogs, loadRange]);
    return [search, loadRange];
};

module.exports = useSearch;
