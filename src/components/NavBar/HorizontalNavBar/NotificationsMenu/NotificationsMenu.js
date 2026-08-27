// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: useRouteFocused } = require('stremio/common/useRouteFocused');
const Popup = require('stremio/components/Popup');
const useBinaryState = require('stremio/common/useBinaryState');
const useNotifications = require('stremio/common/useNotifications');
const { withCoreSuspender } = require('stremio/common/CoreSuspender');
const NotificationsMenuContent = require('./NotificationsMenuContent');
const styles = require('./styles.less');

const NotificationsMenu = (props) => {
    const routeFocused = useRouteFocused();
    const notifications = useNotifications();
    const count = React.useMemo(() => {
        return Object.values(notifications.items).reduce((total, videos) => total + videos.length, 0);
    }, [notifications]);
    const [menuOpen, , closeMenu, toggleMenu] = useBinaryState(false);
    const popupLabelOnClick = React.useCallback((event) => {
        if (!event.nativeEvent.togglePopupPrevented) {
            toggleMenu();
        }
    }, [toggleMenu]);
    const popupMenuOnClick = React.useCallback((event) => {
        event.nativeEvent.togglePopupPrevented = true;
    }, []);
    const renderLabel = React.useMemo(() => ({ ref, className, children }) => (
        props.renderLabel({
            ref,
            className: classnames(className, { 'active': menuOpen }),
            onClick: popupLabelOnClick,
            children,
            count,
        })
    ), [menuOpen, popupLabelOnClick, props.renderLabel, count]);
    const renderMenu = React.useCallback(() => (
        <NotificationsMenuContent onClick={popupMenuOnClick} closeMenu={closeMenu} />
    ), [closeMenu]);
    React.useEffect(() => {
        if (!routeFocused) {
            closeMenu();
        }
    }, [routeFocused]);
    return (
        <Popup
            open={menuOpen}
            direction={'bottom-left'}
            portal
            onCloseRequest={closeMenu}
            renderLabel={renderLabel}
            renderMenu={renderMenu}
            className={styles['notifications-menu-popup-label']}
        />
    );
};

NotificationsMenu.propTypes = {
    renderLabel: PropTypes.func
};

const NotificationsMenuFallback = (props) => props.renderLabel({ className: '', onClick: undefined, children: null, count: 0 });

NotificationsMenuFallback.propTypes = {
    renderLabel: PropTypes.func
};

module.exports = withCoreSuspender(NotificationsMenu, NotificationsMenuFallback);
