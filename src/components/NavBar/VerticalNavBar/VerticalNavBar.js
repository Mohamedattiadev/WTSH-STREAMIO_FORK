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
    const positionedRef = React.useRef(false);

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
            // Every top-level tab switch remounts this whole component (each tab route shares
            // the same router view-slot as its siblings - see routerPaths.tsx), so the very
            // first positioning on a fresh mount has no meaningful "previous" position to
            // animate from - snapping the CSS transition off for just that first placement
            // avoids a visible slide from a throwaway (0,0) starting point (confirmed live:
            // without this, the indicator visibly slid in from the top on every tab switch).
            if (!positionedRef.current) {
                indicatorRef.current.style.transition = 'none';
            }
            indicatorRef.current.style.opacity = '1';
            indicatorRef.current.style.transform = `translate(${activeItem.offsetLeft}px, ${activeItem.offsetTop}px)`;
            if (!positionedRef.current) {
                void indicatorRef.current.offsetHeight;
                indicatorRef.current.style.transition = '';
                positionedRef.current = true;
            }
        } else {
            indicatorRef.current.style.opacity = '0';
        }
    }, [selectedIndex]);

    React.useLayoutEffect(() => {
        moveIndicator();
    }, [moveIndicator, expanded]);

    // On a fresh mount (switching tabs re-mounts this whole component, since each top-level
    // tab route occupies the same router view-slot as its siblings - see routerPaths.tsx) the
    // very first offsetLeft/offsetTop read here can land before the row's final layout is
    // settled, landing the indicator at (0,0) for a stretch before some unrelated later
    // re-render happens to correct it - confirmed live, it measured ~200-300ms, long enough to
    // read as the indicator "jumping" rather than just moving. A ResizeObserver on the nav
    // itself re-measures the instant its real layout is ready, independent of any of that.
    React.useEffect(() => {
        if (!navRef.current || typeof ResizeObserver === 'undefined') {
            return;
        }

        const resizeObserver = new ResizeObserver(moveIndicator);
        resizeObserver.observe(navRef.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [moveIndicator]);

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
