// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const { Link } = require('react-router-dom');
const classnames = require('classnames');
const { HorizontalScroll } = require('stremio/components');
const styles = require('./styles');

// Locale-based onboarding row: surfaces real, official, ad-supported broadcaster
// channels on the YouTube addon (already installed by default for everyone -
// see useAutoInstallEssentialAddons) for languages where no legitimate dedicated
// movie/series catalog addon exists.
//
// Each `id` below is a real YouTube channel ID, individually verified by
// querying the YouTube addon's own `meta` endpoint
// (https://v3-channels.strem.io/meta/channel/yt_id:<id>.json) and checking
// the returned name/description/subscriber count against the broadcaster's
// known official branding - not taken on faith from a search snippet. Do not
// add an entry here without doing the same check first.
const LOCALIZED_CHANNEL_GROUPS = {
    ar: {
        title: 'Arabic Networks on YouTube',
        channels: [
            { id: 'UC39t9YJ_RzgKmmAkq19lhYw', name: 'Rotana Cinema' },
            { id: 'UCJY3eGNWSFRi5YnQiUyIgRA', name: 'Rotana Classic' },
            { id: 'UCsVQJ4sjopcYEQHxWnS2Spg', name: 'Rotana Khaleejia' }
        ]
    },
    tr: {
        title: 'Turkish Networks on YouTube',
        channels: [
            { id: 'UCvFudBDDILdDljN4VIZ4Msw', name: 'TRT 1' },
            { id: 'UCPpBBr7sbZs1BwHfmR9dEyQ', name: 'Kanal D Arşiv' }
        ]
    }
};

const detectLanguage = () => {
    if (typeof navigator === 'undefined' || typeof navigator.language !== 'string') {
        return null;
    }

    return navigator.language.slice(0, 2).toLowerCase();
};

const buildChannelHref = (channelId) => {
    return `/metadetails/channel/${encodeURIComponent(`yt_id:${channelId}`)}`;
};

const LocalizedChannels = ({ className }) => {
    const group = React.useMemo(() => {
        const language = detectLanguage();
        return language !== null ? LOCALIZED_CHANNEL_GROUPS[language] ?? null : null;
    }, []);

    if (group === null) {
        return null;
    }

    return (
        <div className={classnames(className, styles['localized-channels-container'])}>
            <div className={styles['title']}>{group.title}</div>
            <HorizontalScroll className={styles['channels-row']}>
                {group.channels.map((channel) => (
                    <Link
                        key={channel.id}
                        className={styles['channel-chip']}
                        to={buildChannelHref(channel.id)}
                        title={channel.name}
                    >
                        {channel.name}
                    </Link>
                ))}
            </HorizontalScroll>
        </div>
    );
};

LocalizedChannels.propTypes = {
    className: PropTypes.string
};

module.exports = LocalizedChannels;
