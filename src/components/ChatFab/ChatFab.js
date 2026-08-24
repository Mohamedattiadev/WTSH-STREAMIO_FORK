// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useNavigate } = require('react-router');
const ChatIcon = require('stremio/components/ChatIcon');
const ChatPanel = require('stremio/routes/Chat/ChatPanel');
const useBinaryState = require('stremio/common/useBinaryState');
const styles = require('./styles');

// Floating launcher for the "Ask WTS" chat, available from every real content route (not
// rendered on the Chat route itself, where the full panel is already on screen, or Player,
// which has its own in-player chat entry point via ControlBar). Opens the same ChatPanel /
// useChatSession used by the full Chat route, just in `compact` popup mode - one chat session,
// two entry points, never two separate implementations.
const ChatFab = ({ className }) => {
    const navigate = useNavigate();
    const [open, , close, toggle] = useBinaryState(false);

    const expandOnClick = React.useCallback(() => {
        close();
        navigate('/chat');
    }, [close, navigate]);

    return (
        <div className={classnames(className, styles['chat-fab-container'])}>
            <div className={classnames(styles['chat-popup'], { [styles['open']]: open })}>
                {
                    open ?
                        <ChatPanel className={styles['chat-panel']} closeChatPanel={close} onExpand={expandOnClick} />
                        :
                        null
                }
            </div>
            <button type={'button'} className={styles['fab-button']} title={'Ask WTS'} onClick={toggle}>
                <ChatIcon className={styles['icon']} outline={!open} />
                <div className={styles['fab-dot']} />
            </button>
        </div>
    );
};

ChatFab.propTypes = {
    className: PropTypes.string
};

module.exports = ChatFab;
