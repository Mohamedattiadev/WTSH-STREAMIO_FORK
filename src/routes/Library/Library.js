// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useTranslation } = require('react-i18next');
const { useLocation, useParams, useNavigate } = require('react-router');
const { useSearchParams } = require('react-router-dom');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const NotFound = require('stremio/routes/NotFound');
const { useCore } = require('stremio/core');
const { useProfile, useNotifications, useOnScrollToBottom, withCoreSuspender } = require('stremio/common');
const { default: toPath } = require('stremio-router/toPath');
const { DelayedRenderer, Chips, Image, MainNavBars, LibItem, MetaPreview, MultiselectMenu } = require('stremio/components');
const useMetaDetails = require('stremio/routes/MetaDetails/useMetaDetails');
const { default: Placeholder } = require('./Placeholder');
const useLibrary = require('./useLibrary');
const useSelectableInputs = require('./useSelectableInputs');
const styles = require('./styles');

const SCROLL_TO_BOTTOM_TRESHOLD = 400;

function withModel(Library) {
    const withModel = () => {
        const location = useLocation();
        const model = React.useMemo(() => {
            return typeof location.pathname === 'string' ?
                location.pathname.match('/library') ?
                    'library'
                    :
                    location.pathname.match('/continuewatching') ?
                        'continue_watching'
                        :
                        null
                :
                null;
        }, [location?.pathname]);

        if (model === null) return <NotFound />;

        return <Library model={model} />;
    };
    withModel.displayName = 'withModel';
    return withModel;
}

const Library = ({ model }) => {
    const { type } = useParams();
    const urlParams = React.useMemo(() => ({
        type
    }), [type]);
    const [queryParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const core = useCore();
    const profile = useProfile();
    const notifications = useNotifications();
    const [library, loadNextPage] = useLibrary(model, urlParams, queryParams);
    const [typeSelect, sortChips, hasNextPage] = useSelectableInputs(library);
    const [selectedLibItemIndex, setSelectedLibItemIndex] = React.useState(0);
    const selectedLibItem = library.catalog[selectedLibItemIndex] ?? null;
    // LibraryItem (see core/types/LibraryItem.d.ts) is a deliberately thin model - no
    // description/genres/cast/trailerStreams/links at all, unlike Discover/Search's full
    // MetaItem - so the preview panel here never had a Trailer button or real summary to show,
    // not a rendering bug. Same real-data gap Calendar's VideoPreview.tsx already solved for
    // its own thin model: re-fetch the real full MetaDetails on demand, keyed off the item's
    // own real type/id, and layer just the richer fields on top once it's loaded.
    const enrichedMetaDetailsUrlParams = React.useMemo(() => {
        return selectedLibItem !== null ? { type: selectedLibItem.type, id: selectedLibItem._id } : {};
    }, [selectedLibItem]);
    const enrichedMetaDetails = useMetaDetails(enrichedMetaDetailsUrlParams);
    const enrichedLibItem = enrichedMetaDetails.metaItem !== null && enrichedMetaDetails.metaItem.content.type === 'Ready' ?
        enrichedMetaDetails.metaItem.content.content
        :
        null;
    const scrollContainerRef = React.useRef(null);
    const metaPreviewRef = React.useRef(null);
    const onScrollToBottom = React.useCallback(() => {
        if (hasNextPage) {
            loadNextPage();
        }
    }, [hasNextPage, loadNextPage]);
    const onScroll = useOnScrollToBottom(onScrollToBottom, SCROLL_TO_BOTTOM_TRESHOLD);
    React.useLayoutEffect(() => {
        if (scrollContainerRef.current !== null && library.selected && library.selected.request.page === 1 && library.catalog.length !== 0) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [profile.auth, library.selected]);
    React.useEffect(() => {
        if (!library.selected?.type && typeSelect.value) {
            navigate(toPath(typeSelect.value));
        }
    }, [typeSelect.value, library.selected]);
    React.useEffect(() => {
        setSelectedLibItemIndex(0);
    }, [library.selected]);
    const removeFromLibrary = React.useCallback(() => {
        if (selectedLibItem === null) {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'RemoveFromLibrary',
                args: selectedLibItem._id
            }
        });
    }, [core, selectedLibItem]);
    const toggleWatched = React.useCallback(() => {
        if (selectedLibItem === null) {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'LibraryItemMarkAsWatched',
                args: {
                    id: selectedLibItem._id,
                    is_watched: !selectedLibItem.watched
                }
            }
        });
    }, [core, selectedLibItem]);
    const libItemsOnFocusCapture = React.useCallback((event) => {
        if (event.target.dataset.index !== null && !isNaN(event.target.dataset.index)) {
            setSelectedLibItemIndex(parseInt(event.target.dataset.index, 10));
        }
    }, []);
    const libItemOnClick = React.useCallback((event) => {
        const visible = metaPreviewRef.current !== null && window.getComputedStyle(metaPreviewRef.current).display !== 'none';
        if (event.currentTarget.dataset.index !== selectedLibItemIndex.toString() && visible) {
            event.preventDefault();
            event.currentTarget.focus();
        }
    }, [selectedLibItemIndex]);
    return (
        <MainNavBars className={styles['library-container']} route={model}>
            {
                profile.auth !== null ?
                    <div className={styles['library-content']}>
                        <div className={styles['catalog-container']}>
                            <div className={styles['selectable-inputs-container']}>
                                <MultiselectMenu {...typeSelect} className={styles['select-input-container']} />
                                <Chips {...sortChips} className={styles['select-input-container']} />
                            </div>
                            {
                                library.selected === null ?
                                    <DelayedRenderer delay={500}>
                                        <div className={styles['message-container']}>
                                            <Image
                                                className={styles['image']}
                                                src={require('/assets/images/empty.png')}
                                                alt={' '}
                                            />
                                            <div className={styles['message-label']}>{model === 'library' ? t('LIBRARY_NOT_LOADED') : t('BOARD_CONTINUE_WATCHING_NOT_LOADED')}</div>
                                        </div>
                                    </DelayedRenderer>
                                    :
                                    library.catalog.length === 0 ?
                                        <div className={styles['message-container']}>
                                            <Image
                                                className={styles['image']}
                                                src={require('/assets/images/empty.png')}
                                                alt={' '}
                                            />
                                            <div className={styles['message-label']}>{model === 'library' ? t('LIBRARY_EMPTY') : t('BOARD_CONTINUE_WATCHING_EMPTY')}</div>
                                        </div>
                                        :
                                        <div ref={scrollContainerRef} className={classnames(styles['meta-items-container'], 'animation-fade-in')} onScroll={onScroll} onFocusCapture={libItemsOnFocusCapture}>
                                            {
                                                library.catalog.map((libItem, index) => (
                                                    <LibItem
                                                        {...libItem}
                                                        key={index}
                                                        className={classnames({ 'selected': selectedLibItemIndex === index })}
                                                        notifications={notifications}
                                                        detailsVideosFirst={model === 'library'}
                                                        data-index={index}
                                                        onClick={libItemOnClick}
                                                    />
                                                ))
                                            }
                                        </div>
                            }
                        </div>
                        {
                            selectedLibItem !== null ?
                                <MetaPreview
                                    className={styles['meta-preview-container']}
                                    compact={true}
                                    ref={metaPreviewRef}
                                    name={selectedLibItem.name}
                                    logo={enrichedLibItem?.logo ?? selectedLibItem.logo}
                                    background={selectedLibItem.poster}
                                    poster={selectedLibItem.poster}
                                    runtime={enrichedLibItem?.runtime}
                                    releaseInfo={enrichedLibItem?.releaseInfo}
                                    released={enrichedLibItem?.released}
                                    description={enrichedLibItem?.description}
                                    links={enrichedLibItem?.links}
                                    deepLinks={selectedLibItem.deepLinks}
                                    trailerStreams={enrichedLibItem?.trailerStreams}
                                    inLibrary={true}
                                    toggleInLibrary={removeFromLibrary}
                                    watched={selectedLibItem.watched}
                                    toggleWatched={toggleWatched}
                                    metaId={selectedLibItem._id}
                                    like={enrichedLibItem?.like}
                                />
                                :
                                null
                        }
                    </div>
                    :
                    <Placeholder />
            }
        </MainNavBars>
    );
};

Library.propTypes = {
    model: PropTypes.oneOf(['library', 'continue_watching']),
};

const LibraryFallback = ({ model }) => (
    <MainNavBars className={styles['library-container']} route={model} />
);

LibraryFallback.propTypes = Library.propTypes;

module.exports = withModel(withCoreSuspender(Library, LibraryFallback));
