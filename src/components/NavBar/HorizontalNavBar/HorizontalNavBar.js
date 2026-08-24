// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button, Image } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const useProfile = require('stremio/common/useProfile');
const { useHorizontalNavGamepadNavigation } = require('stremio/services/GamepadNavigation');
const SearchBar = require('./SearchBar');
const NavMenu = require('./NavMenu');
const NotificationsMenu = require('./NotificationsMenu');
const styles = require('./styles');
const { t } = require('i18next');

const HorizontalNavBar = React.memo(({ className, route, query, title, backButton, searchBar, fullscreenButton, navMenu, originPath, hdrInfo, ...props }) => {
    const navigate = useNavigate();
    const profile = useProfile();
    const backButtonOnClick = React.useCallback(() => {
        if (originPath) {
            navigate(originPath, { replace: true });
        } else {
            navigate(-1);
        }
    }, [originPath, navigate]);
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    // Email is the only real identity field stremio-core exposes (no display name) - the
    // local-part before "@" is used as a readable name, and its first two letters as the
    // avatar's initials. Both derive from the user's own real email, nothing invented.
    const displayName = React.useMemo(() => {
        if (profile.auth === null) {
            return null;
        }
        const email = profile.auth.user.email;
        return typeof email === 'string' && email.length > 0 ? email.split('@')[0] : null;
    }, [profile.auth]);
    const initials = React.useMemo(() => {
        return displayName !== null ? displayName.slice(0, 2).toUpperCase() : null;
    }, [displayName]);
    const renderNavMenuLabel = React.useCallback(({ ref, className, onClick, children, }) => (
        <Button ref={ref} className={classnames(className, styles['avatar-group-container'])} tabIndex={-1} onClick={onClick}>
            {
                displayName !== null ?
                    <div className={styles['welcome-text']}>Welcome, <strong>{displayName}</strong></div>
                    :
                    null
            }
            <div className={styles['avatar-container']}>
                {
                    initials !== null ?
                        <div className={styles['avatar-initials']}>{initials}</div>
                        :
                        <Icon className={styles['icon']} name={'person-outline'} />
                }
            </div>
            <Icon className={styles['avatar-chevron']} name={'caret-down'} />
            {children}
        </Button>
    ), [displayName, initials]);
    const renderNotificationsLabel = React.useCallback(({ ref, className, onClick, children, count }) => (
        <Button ref={ref} className={classnames(className, styles['button-container'], styles['notifications-button-container'])} title={t('NOTIFICATIONS')} tabIndex={-1} onClick={onClick}>
            <Icon className={styles['icon']} name={'notifications'} />
            {
                count > 0 ?
                    <div className={styles['notifications-badge']}>{count > 9 ? '9+' : count}</div>
                    :
                    null
            }
            {children}
        </Button>
    ), []);
    useHorizontalNavGamepadNavigation(route || className, backButton);
    return (
        <nav {...props} className={classnames(className, styles['horizontal-nav-bar-container'])}>
            {
                backButton ?
                    <Button className={classnames(styles['button-container'], styles['back-button-container'])} tabIndex={-1} onClick={backButtonOnClick}>
                        <Icon className={styles['icon']} name={'chevron-back'} />
                    </Button>
                    :
                    <div className={styles['logo-container']}>
                        <Image
                            className={styles['logo']}
                            src={require('/assets/images/stremio_symbol.png')}
                            alt={' '}
                        />
                    </div>
            }
            {
                typeof title === 'string' && title.length > 0 ?
                    <h2 className={styles['title']}>{title}</h2>
                    :
                    null
            }
            {
                searchBar && route !== 'addons' ?
                    <SearchBar className={styles['search-bar']} query={query} active={route === 'search'} />
                    :
                    null
            }
            <div className={styles['buttons-container']}>
                {
                    hdrInfo && (hdrInfo.gamma === 'pq' || hdrInfo.gamma === 'hlg') ?
                        <div className={styles['hdr-indicator']} title={hdrInfo.gamma === 'pq' ? 'HDR10' : 'HLG'}>
                            <Icon className={styles['icon']} name={'hdr'} />
                        </div>
                        :
                        null
                }
                {
                    navMenu ?
                        <NotificationsMenu renderLabel={renderNotificationsLabel} />
                        :
                        null
                }
                {
                    supported && fullscreenButton ?
                        <Button className={styles['button-container']} title={fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')} tabIndex={-1} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                            <Icon className={styles['icon']} name={fullscreen ? 'minimize' : 'maximize'} />
                        </Button>
                        :
                        null
                }
                {
                    navMenu ?
                        <NavMenu renderLabel={renderNavMenuLabel} />
                        :
                        null
                }
            </div>
        </nav>
    );
});

HorizontalNavBar.displayName = 'HorizontalNavBar';

HorizontalNavBar.propTypes = {
    className: PropTypes.string,
    route: PropTypes.string,
    query: PropTypes.string,
    title: PropTypes.string,
    backButton: PropTypes.bool,
    searchBar: PropTypes.bool,
    fullscreenButton: PropTypes.bool,
    navMenu: PropTypes.bool,
    originPath: PropTypes.string,
    hdrInfo: PropTypes.shape({
        gamma: PropTypes.string,
    }),
};

module.exports = HorizontalNavBar;
