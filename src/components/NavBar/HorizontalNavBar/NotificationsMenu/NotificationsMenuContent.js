// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { default: Icon } = require('stremio/components/Icon');
const { default: Image } = require('stremio/components/Image');
const { default: Button } = require('stremio/components/Button');
const { useCore } = require('stremio/core');
const useModelState = require('stremio/common/useModelState');
const useNotifications = require('stremio/common/useNotifications');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const styles = require('./styles.less');

// Real events only: an entry only ever exists here because stremio-core's `ctx.notifications`
// model actually flagged unwatched new episodes for that library item - nothing here is
// invented client-side. We can only render a name/poster for entries that also show up in
// the (already-fetched-elsewhere) continue-watching preview, so a notification whose item
// isn't in that preview is skipped rather than shown with placeholder text.
const buildEntries = (notifications, previewItems) => {
    const itemsById = new Map(previewItems.map((item) => [item._id ?? item.id, item]));
    return Object.keys(notifications.items)
        .map((metaId) => {
            const videos = notifications.items[metaId];
            const item = itemsById.get(metaId);
            if (!item || !Array.isArray(videos) || videos.length === 0) {
                return null;
            }

            const latestReleased = videos.reduce((latest, video) => {
                const released = new Date(video.videoReleased);
                return !isNaN(released.getTime()) && (latest === null || released > latest) ? released : latest;
            }, null);

            return { metaId, item, count: videos.length, latestReleased };
        })
        .filter((entry) => entry !== null)
        .sort((a, b) => (b.latestReleased?.getTime() ?? 0) - (a.latestReleased?.getTime() ?? 0));
};

const NotificationsMenuContent = ({ onClick, closeMenu }) => {
    const core = useCore();
    const notifications = useNotifications();
    const continueWatchingPreview = useModelState({ model: 'continue_watching_preview' });

    const entries = React.useMemo(() => {
        return buildEntries(notifications, continueWatchingPreview.items);
    }, [notifications, continueWatchingPreview.items]);

    const dismissOnClick = React.useCallback((event, metaId) => {
        event.preventDefault();
        event.stopPropagation();
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'DismissNotificationItem',
                args: metaId
            }
        });
    }, []);

    const entryOnClick = React.useCallback(() => {
        closeMenu();
    }, [closeMenu]);

    return (
        <div className={styles['notifications-menu-container']} onClick={onClick}>
            <div className={styles['header']}>
                <div className={styles['title']}>Notifications</div>
            </div>
            {
                entries.length > 0 ?
                    <div className={styles['list']}>
                        {entries.map(({ metaId, item, count, latestReleased }) => (
                            <Button
                                key={metaId}
                                className={styles['entry']}
                                href={getMetaDetailsHref(item.deepLinks, true)}
                                onClick={entryOnClick}
                            >
                                <Image className={styles['poster']} src={item.poster} alt={' '} />
                                <div className={styles['body']}>
                                    <div className={styles['name']}>{item.name}</div>
                                    <div className={styles['meta']}>
                                        {count === 1 ? 'New episode available' : `${count} new episodes available`}
                                        {
                                            latestReleased !== null ?
                                                <React.Fragment> · {latestReleased.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</React.Fragment>
                                                :
                                                null
                                        }
                                    </div>
                                </div>
                                <Button className={styles['dismiss']} title={'Dismiss'} onClick={(event) => dismissOnClick(event, metaId)}>
                                    <Icon className={styles['dismiss-icon']} name={'close'} />
                                </Button>
                            </Button>
                        ))}
                    </div>
                    :
                    <div className={styles['empty']}>You're all caught up.</div>
            }
        </div>
    );
};

NotificationsMenuContent.propTypes = {
    onClick: PropTypes.func,
    closeMenu: PropTypes.func
};

module.exports = NotificationsMenuContent;
