// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { createPortal } = require('react-dom');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const FocusLock = require('react-focus-lock').default;
const { default: useRouteFocused } = require('stremio/common/useRouteFocused');
const styles = require('./styles');

const PORTAL_MARGIN = 8;

const getAnchorElement = (element) => {
    if (element === document.documentElement) {
        return element;
    }

    const style = window.getComputedStyle(element);
    if (style.overflowY.indexOf('auto') !== -1 || style.overflowY.indexOf('scroll') !== -1) {
        return element;
    }

    return getAnchorElement(element.parentElement);
};

const Popup = ({ open, direction, renderLabel, renderMenu, dataset, onCloseRequest, portal, ...props }) => {
    const routeFocused = useRouteFocused();
    const labelRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const [autoDirection, setAutoDirection] = React.useState(null);
    // Only used when `portal` is set - topbar dropdowns (language switcher, notifications,
    // account menu) live inside .main-nav-bars-container, a stacking context that ties (both
    // z-index:1) with App's .toasts-container and loses on DOM order, so no z-index on
    // .menu-container itself can ever paint above a toast or the routed page content beneath it,
    // no matter how high. Portaling to document.body escapes that ancestor chain entirely - same
    // technique AddToCalendarButton already uses for its popover.
    const [portalCoords, setPortalCoords] = React.useState(null);
    // pointerdown always fires before mousedown for the same physical click, and the window
    // listener below reacts to either independently - each carries its own native Event
    // instance, so both need their own flag set, not just mousedown's. For the non-portal menu
    // (nested inside .label-container) this was masked by the `labelRef.current.contains` check
    // already saving it regardless; portal mode has no such ancestor relationship to fall back on.
    const menuOnMouseDown = React.useCallback((event) => {
        event.nativeEvent.closePopupPrevented = true;
    }, []);
    React.useEffect(() => {
        const onCloseEvent = (event) => {
            if (!event.closePopupPrevented && typeof onCloseRequest === 'function') {
                const closeEvent = {
                    type: 'close',
                    nativeEvent: event,
                    dataset: dataset
                };
                switch (event.type) {
                    case 'keydown':
                        if (event.code === 'Escape') {
                            onCloseRequest(closeEvent);
                        }
                        break;
                    case 'mousedown':
                        if (event.target !== document.documentElement && !labelRef.current.contains(event.target)) {
                            onCloseRequest(closeEvent);
                        }
                        break;
                    case 'pointerdown':
                        if (event.target !== document.documentElement && !labelRef.current.contains(event.target)) {
                            onCloseRequest(closeEvent);
                        }
                        break;
                }
            }
        };
        if (routeFocused && open) {
            window.addEventListener('keydown', onCloseEvent);
            window.addEventListener('mousedown', onCloseEvent);
            window.addEventListener('pointerdown', onCloseEvent);
        }
        return () => {
            window.removeEventListener('keydown', onCloseEvent);
            window.removeEventListener('mousedown', onCloseEvent);
            window.removeEventListener('pointerdown', onCloseEvent);
        };
    }, [routeFocused, open, onCloseRequest, dataset]);
    React.useLayoutEffect(() => {
        if (open && !portal) {
            const autoDirection = [];
            const anchor = getAnchorElement(labelRef.current);
            const anchorRect = anchor.getBoundingClientRect();

            const labelRect = labelRef.current.getBoundingClientRect();
            const menuRect = menuRef.current.getBoundingClientRect();
            const labelPosition = {
                left: labelRect.left - anchorRect.left,
                top: labelRect.top - anchorRect.top,
                right: (anchorRect.width + anchorRect.left) - (labelRect.left + labelRect.width),
                bottom: (anchorRect.height + anchorRect.top) - (labelRect.top + labelRect.height)
            };

            if (menuRect.height <= labelPosition.bottom) {
                autoDirection.push('bottom');
            } else if (menuRect.height <= labelPosition.top) {
                autoDirection.push('top');
            } else if (labelPosition.bottom >= labelPosition.top) {
                autoDirection.push('bottom');
            } else {
                autoDirection.push('top');
            }

            if (menuRect.width <= (labelPosition.right + labelRect.width)) {
                autoDirection.push('right');
            } else if (menuRect.width <= (labelPosition.left + labelRect.width)) {
                autoDirection.push('left');
            } else if (labelPosition.right > labelPosition.left) {
                autoDirection.push('right');
            } else {
                autoDirection.push('left');
            }

            setAutoDirection(autoDirection.join('-'));
        } else {
            setAutoDirection(null);
        }
    }, [open, portal]);
    React.useLayoutEffect(() => {
        if (!portal) {
            return;
        }
        if (!open || !labelRef.current || !menuRef.current) {
            setPortalCoords(null);
            return;
        }

        const updatePosition = () => {
            const labelRect = labelRef.current.getBoundingClientRect();
            const menuRect = menuRef.current.getBoundingClientRect();
            const [wantVertical, wantHorizontal] = (direction || '').split('-');
            const spaceBelow = window.innerHeight - labelRect.bottom;
            const spaceAbove = labelRect.top;
            const vertical = wantVertical || (menuRect.height <= spaceBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top');
            const spaceRight = window.innerWidth - labelRect.left;
            const spaceLeft = labelRect.right;
            const horizontal = wantHorizontal || (menuRect.width <= spaceRight || spaceRight >= spaceLeft ? 'right' : 'left');

            let top = vertical === 'bottom' ? labelRect.bottom + PORTAL_MARGIN : labelRect.top - PORTAL_MARGIN - menuRect.height;
            let left = horizontal === 'right' ? labelRect.left : labelRect.right - menuRect.width;
            top = Math.min(Math.max(PORTAL_MARGIN, top), window.innerHeight - menuRect.height - PORTAL_MARGIN);
            left = Math.min(Math.max(PORTAL_MARGIN, left), window.innerWidth - menuRect.width - PORTAL_MARGIN);
            setPortalCoords({ top, left });
        };

        updatePosition();
        // NavMenu's content (email address, several rows of links) isn't necessarily laid out
        // to its final size on this first pass the way LanguageMenu's short, static list always
        // is - confirmed live, its menu measured 0-width here once, computing a `left` that put
        // the whole panel off the right edge of the screen and never correcting itself since
        // this effect only ever ran once per open. A ResizeObserver re-measures whenever the
        // menu's real size actually settles, regardless of what causes the delay.
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        const resizeObserver = new ResizeObserver(updatePosition);
        resizeObserver.observe(menuRef.current);
        return () => {
            resizeObserver.disconnect();
        };
    }, [open, portal, direction]);
    const menu = open ?
        <FocusLock
            ref={menuRef}
            className={portal ?
                classnames(styles['menu-container'], styles['menu-container-portal'], { [styles['visible']]: portalCoords !== null })
                :
                classnames(styles['menu-container'], { [styles[`menu-direction-${autoDirection}`]]: !direction }, { [styles[`menu-direction-${direction}`]]: direction })
            }
            autoFocus={false}
            lockProps={
                portal && portalCoords !== null ?
                    { onMouseDown: menuOnMouseDown, onPointerDown: menuOnMouseDown, style: { top: portalCoords.top, left: portalCoords.left } }
                    :
                    { onMouseDown: menuOnMouseDown, onPointerDown: menuOnMouseDown }
            }
        >
            {renderMenu()}
        </FocusLock>
        :
        null;
    return (
        <React.Fragment>
            {renderLabel({
                ...props,
                ref: labelRef,
                className: classnames(styles['label-container'], props.className, { 'active': open }),
                children: portal ? null : menu
            })}
            {portal && menu ? createPortal(menu, document.body) : null}
        </React.Fragment>
    );
};

Popup.propTypes = {
    open: PropTypes.bool,
    className: PropTypes.string,
    direction: PropTypes.oneOf(['top-left', 'bottom-left', 'top-right', 'bottom-right']),
    renderLabel: PropTypes.func.isRequired,
    renderMenu: PropTypes.func.isRequired,
    dataset: PropTypes.object,
    onCloseRequest: PropTypes.func,
    // Escapes the menu to document.body (position: fixed, coordinates measured from the label on
    // open) instead of anchoring it in-place - needed for topbar dropdowns (see the portalCoords
    // comment above) whose local z-index can never outrank a sibling stacking context like App's
    // toast layer. Every other existing Popup usage (Multiselect, etc.) leaves this off and keeps
    // today's in-place, ancestor-relative positioning unchanged.
    portal: PropTypes.bool
};

module.exports = Popup;
