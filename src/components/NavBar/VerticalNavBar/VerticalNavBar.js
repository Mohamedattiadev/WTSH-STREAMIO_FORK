// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('stremio/components/Icon');
const { Logo } = require('stremio/components');
const NavTabButton = require('./NavTabButton');
const styles = require('./styles');

const RAIL_EXPANDED_STORAGE_KEY = 'stremio-ember-rail-expanded-v1';

const readRailExpanded = () => {
    try {
        return window.localStorage.getItem(RAIL_EXPANDED_STORAGE_KEY) === '1';
    } catch (e) {
        return false;
    }
};

const writeRailExpanded = (expanded) => {
    try {
        window.localStorage.setItem(RAIL_EXPANDED_STORAGE_KEY, expanded ? '1' : '0');
    } catch (e) {
        // localStorage unavailable (private mode, etc); collapse state just won't persist
    }
};

const VerticalNavBar = React.memo(React.forwardRef(({ className, selected, tabs }, ref) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = React.useState(readRailExpanded);
    const navRef = React.useRef(null);
    const indicatorRef = React.useRef(null);

    const toggleExpandedOnClick = React.useCallback(() => {
        setExpanded((prevExpanded) => {
            const nextExpanded = !prevExpanded;
            writeRailExpanded(nextExpanded);
            return nextExpanded;
        });
    }, []);

    const selectedIndex = React.useMemo(() => {
        return Array.isArray(tabs) ? tabs.findIndex((tab) => tab.id === selected) : -1;
    }, [tabs, selected]);

    const moveIndicator = React.useCallback(() => {
        if (!navRef.current || !indicatorRef.current || selectedIndex === -1) {
            return;
        }

        const items = navRef.current.querySelectorAll(`.${styles['nav-tab-button']}`);
        const activeItem = items[selectedIndex];
        if (activeItem) {
            indicatorRef.current.style.opacity = '1';
            indicatorRef.current.style.transform = `translateY(${activeItem.offsetTop}px)`;
        } else {
            indicatorRef.current.style.opacity = '0';
        }
    }, [selectedIndex]);

    React.useLayoutEffect(() => {
        moveIndicator();
    }, [moveIndicator, expanded]);

    React.useEffect(() => {
        window.addEventListener('resize', moveIndicator);
        return () => {
            window.removeEventListener('resize', moveIndicator);
        };
    }, [moveIndicator]);

    return (
        <nav ref={ref} className={classnames(className, styles['vertical-nav-bar-container'], { 'expanded': expanded })}>
            <button
                type={'button'}
                className={styles['rail-toggle']}
                aria-label={expanded ? t('COLLAPSE_SIDEBAR') : t('EXPAND_SIDEBAR')}
                onClick={toggleExpandedOnClick}
            >
                <Icon className={styles['rail-toggle-icon']} name={'chevron-forward'} />
            </button>
            <div className={styles['rail-mark-row']}>
                <div className={styles['rail-mark']}>
                    <Logo className={styles['rail-mark-logo']} />
                </div>
                <span className={styles['rail-wordmark']}>WTSH</span>
            </div>
            <div ref={navRef} className={styles['rail-nav']}>
                <div ref={indicatorRef} className={styles['rail-indicator']} />
                {
                    Array.isArray(tabs) ?
                        tabs.map((tab, index) => (
                            <NavTabButton
                                key={index}
                                className={styles['nav-tab-button']}
                                selected={tab.id === selected}
                                expanded={expanded}
                                href={tab.href}
                                logo={tab.logo}
                                icon={tab.icon}
                                iconComponent={tab.iconComponent}
                                label={t(tab.label)}
                                onClick={tab.onClick}
                            />
                        ))
                        :
                        null
                }
            </div>
        </nav>
    );
}));

VerticalNavBar.displayName = 'VerticalNavBar';

VerticalNavBar.propTypes = {
    className: PropTypes.string,
    selected: PropTypes.string,
    tabs: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        label: PropTypes.string,
        logo: PropTypes.string,
        icon: PropTypes.string,
        iconComponent: PropTypes.elementType,
        href: PropTypes.string,
        onClick: PropTypes.func
    }))
};

module.exports = VerticalNavBar;
