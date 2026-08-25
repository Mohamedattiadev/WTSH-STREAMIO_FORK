// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const { default: toPath } = require('stremio-router/toPath');
const PropTypes = require('prop-types');
const { default: getMetaDetailsHref } = require('stremio/common/getMetaDetailsHref');
const MetaItem = require('stremio/components/MetaItem');

const LibItem = ({ _id, notifications, watched, detailsVideosFirst, ...props }) => {
    const navigate = useNavigate();
    const detailsHref = React.useMemo(() => getMetaDetailsHref(props.deepLinks, detailsVideosFirst), [props.deepLinks, detailsVideosFirst]);
    const playerHref = props.deepLinks && typeof props.deepLinks.player === 'string' ? props.deepLinks.player : null;

    const newVideos = React.useMemo(() => {
        const count = notifications.items?.[_id]?.length ?? 0;
        return Math.min(Math.max(count, 0), 99);
    }, [_id, notifications]);

    const onPlayClick = React.useCallback((event) => {
        event.preventDefault();
        if (typeof playerHref === 'string') {
            navigate(toPath(playerHref));
        }
    }, [navigate, playerHref]);

    return (
        <MetaItem
            {...props}
            href={detailsHref}
            watched={watched}
            newVideos={newVideos}
            onPlayClick={typeof playerHref === 'string' ? onPlayClick : null}
        />
    );
};

LibItem.propTypes = {
    _id: PropTypes.string,
    progress: PropTypes.number,
    notifications: PropTypes.object,
    watched: PropTypes.bool,
    detailsVideosFirst: PropTypes.bool,
    deepLinks: PropTypes.shape({
        metaDetailsVideos: PropTypes.string,
        metaDetailsStreams: PropTypes.string,
        player: PropTypes.string
    })
};

module.exports = LibItem;
