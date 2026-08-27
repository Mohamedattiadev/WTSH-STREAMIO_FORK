// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button } = require('stremio/components');
const { t } = require('i18next');
const styles = require('./styles');

// Mockup's player puts skip -10/play/skip +10 as one large floating cluster over the
// video itself, rather than only inline in the bottom bar. Video and this layer are
// separate sibling subtrees (see Video.js), so a click here never bubbles into Video's
// own onClick (which toggles play/pause on a direct video click) - no double-toggle risk.
const CenterControls = React.forwardRef(({ className, paused, seekTimeDuration, onSeekPrev, onSeekNext, onPlayRequested, onPauseRequested, ...props }, ref) => {
    const seekSeconds = typeof seekTimeDuration === 'number' ? Math.round(seekTimeDuration / 1000) : null;
    const onSeekPrevClick = React.useCallback((event) => {
        if (typeof onSeekPrev === 'function') {
            onSeekPrev(event);
        }
    }, [onSeekPrev]);
    const onSeekNextClick = React.useCallback((event) => {
        if (typeof onSeekNext === 'function') {
            onSeekNext(event);
        }
    }, [onSeekNext]);
    const onPlayPauseClick = React.useCallback(() => {
        if (paused) {
            if (typeof onPlayRequested === 'function') {
                onPlayRequested();
            }
        } else {
            if (typeof onPauseRequested === 'function') {
                onPauseRequested();
            }
        }
    }, [paused, onPlayRequested, onPauseRequested]);
    return (
        <div ref={ref} {...props} className={classnames(className, styles['center-controls-container'])}>
            {
                typeof onSeekPrev === 'function' ?
                    <Button className={classnames(styles['skip-button'])} title={t('PLAYER_SEEK_BACKWARD')} tabIndex={-1} onClick={onSeekPrevClick}>
                        <Icon className={styles['skip-icon']} name={'skip-back'} />
                        {seekSeconds !== null ? <span className={styles['skip-label']}>{seekSeconds}</span> : null}
                    </Button>
                    :
                    null
            }
            <Button className={classnames(styles['play-button'], { 'disabled': typeof paused !== 'boolean' })} title={paused ? t('PLAYER_PLAY') : t('PLAYER_PAUSE')} tabIndex={-1} onClick={onPlayPauseClick}>
                <Icon className={styles['play-icon']} name={typeof paused !== 'boolean' || paused ? 'play' : 'pause'} />
            </Button>
            {
                typeof onSeekNext === 'function' ?
                    <Button className={classnames(styles['skip-button'])} title={t('PLAYER_SEEK_FORWARD')} tabIndex={-1} onClick={onSeekNextClick}>
                        <Icon className={styles['skip-icon']} name={'skip-forward'} />
                        {seekSeconds !== null ? <span className={styles['skip-label']}>{seekSeconds}</span> : null}
                    </Button>
                    :
                    null
            }
        </div>
    );
});

CenterControls.displayName = 'CenterControls';

CenterControls.propTypes = {
    className: PropTypes.string,
    paused: PropTypes.bool,
    seekTimeDuration: PropTypes.number,
    onSeekPrev: PropTypes.func,
    onSeekNext: PropTypes.func,
    onPlayRequested: PropTypes.func,
    onPauseRequested: PropTypes.func,
};

module.exports = CenterControls;
