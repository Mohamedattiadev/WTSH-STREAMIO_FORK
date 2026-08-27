// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useMemo } from 'react';
import { useCore } from 'stremio/core';
import Icon from 'stremio/components/Icon';
import { Button, MetaPreview } from 'stremio/components';
import routesRegexp from 'stremio/common/routesRegexp';
import toPath from 'stremio-router/toPath';
import useMetaDetails from 'stremio/routes/MetaDetails/useMetaDetails';
import styles from './VideoPreview.less';

type Props = {
    deepLink: string,
    onCloseRequest: () => void,
};

// Calendar's own model (CalendarContentItem) is deliberately thin - just id/name/poster/season/
// episode/deepLinks, no description/genres/cast/trailer/library state (confirmed against its real
// type definition, the same kind of real data boundary hit earlier with Cinemeta's `awards`
// field). Rather than show a shallower panel than Discover/Search's, this re-fetches the real,
// full MetaDetails for the selected item on demand - the exact same model/hook MetaDetails.js
// itself uses, keyed by {type, id} parsed from the item's own real metaDetailsStreams deep link
// (the same regexp the app's own router uses for that route) - so the panel is genuinely as rich
// as Discover/Search's, not a fabricated one.
const VideoPreview = ({ deepLink, onCloseRequest }: Props) => {
    const core = useCore();
    const urlParams = useMemo(() => {
        const match = typeof deepLink === 'string' ? toPath(deepLink).match(routesRegexp.metadetails.regexp) : null;
        return match ? { type: match[1], id: match[2] } : {};
    }, [deepLink]);
    const metaDetails = useMetaDetails(urlParams);
    const ready = metaDetails.metaItem !== null && metaDetails.metaItem.content.type === 'Ready';
    const item = ready ? metaDetails.metaItem.content.content : null;

    const addToLibrary = useCallback(() => {
        if (!ready) {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: { action: 'AddToLibrary', args: item }
        });
    }, [core, ready, item]);
    const removeFromLibrary = useCallback(() => {
        if (!ready) {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: { action: 'RemoveFromLibrary', args: item.id }
        });
    }, [core, ready, item]);
    const toggleWatched = useCallback(() => {
        if (!ready) {
            return;
        }

        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'MetaItemMarkAsWatched',
                args: { meta_item: item, is_watched: !item.watched }
            }
        });
    }, [core, ready, item]);

    return (
        <div className={styles['video-preview']}>
            <Button className={styles['close-button']} title={'Close'} onClick={onCloseRequest}>
                <Icon className={styles['icon']} name={'close'} />
            </Button>
            {
                ready ?
                    <MetaPreview
                        compact
                        name={item.name}
                        logo={item.logo}
                        background={item.background}
                        runtime={item.runtime}
                        releaseInfo={item.releaseInfo}
                        released={item.released}
                        description={item.description}
                        links={item.links}
                        deepLinks={item.deepLinks}
                        trailerStreams={item.trailerStreams}
                        inLibrary={item.inLibrary}
                        toggleInLibrary={item.inLibrary ? removeFromLibrary : addToLibrary}
                        watched={item.watched}
                        toggleWatched={toggleWatched}
                        metaId={item.id}
                        like={item.like}
                    />
                    :
                    <div className={styles['loading']}>Loading…</div>
            }
        </div>
    );
};

export default VideoPreview;
