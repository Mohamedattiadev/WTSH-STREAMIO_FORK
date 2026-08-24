// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { default: Button } = require('stremio/components/Button');
const ChatIcon = require('stremio/components/ChatIcon');
const { default: HorizontalScroll } = require('stremio/components/HorizontalScroll');
const MetaItem = require('stremio/components/MetaItem');
const { default: TextInput } = require('stremio/components/TextInput');
const useChatSession = require('../useChatSession');
const useSupabaseAuth = require('stremio/common/Supabase/useSupabaseAuth');
const styles = require('./styles');

const SUGGESTIONS = [
    'Something funny under 2 hours',
    'Sci-fi movie like Interstellar',
    'Best animated movies'
];

const ChatPanel = ({ className, compact, closeChatPanel, onExpand }) => {
    const { messages, inputValue, setInputValue, sendMessage, isPending } = useChatSession();
    const { user: supabaseUser } = useSupabaseAuth();
    const listRef = React.useRef(null);

    React.useEffect(() => {
        if (listRef.current !== null) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages]);

    const onInputChange = React.useCallback((event) => {
        setInputValue(event.currentTarget.value);
    }, [setInputValue]);

    const onSubmit = React.useCallback(() => {
        sendMessage(inputValue);
    }, [sendMessage, inputValue]);

    const onSuggestionClick = React.useCallback((suggestion) => {
        sendMessage(suggestion);
    }, [sendMessage]);

    return (
        <div className={classnames(className, styles['chat-panel'], { [styles['compact']]: compact })}>
            <div className={styles['header']}>
                <ChatIcon className={styles['header-icon']} />
                <div className={styles['header-title']}>Ask WTS</div>
                <div className={styles['header-actions']}>
                    {
                        typeof onExpand === 'function' ?
                            <Button className={styles['close-button']} title={'Open full chat'} onClick={onExpand}>
                                <Icon className={styles['icon']} name={'maximize'} />
                            </Button>
                            :
                            null
                    }
                    {
                        typeof closeChatPanel === 'function' ?
                            <Button className={styles['close-button']} title={'Close'} onClick={closeChatPanel}>
                                <Icon className={styles['icon']} name={'x'} />
                            </Button>
                            :
                            null
                    }
                </div>
            </div>
            <div ref={listRef} className={styles['message-list']}>
                {
                    messages.length === 0 ?
                        <div className={styles['empty-state']}>
                            <div className={styles['empty-title']}>Ask for a recommendation from your installed addons</div>
                            <div className={styles['suggestions']}>
                                {SUGGESTIONS.map((suggestion) => (
                                    <Button
                                        key={suggestion}
                                        className={styles['suggestion-chip']}
                                        title={suggestion}
                                        onClick={() => onSuggestionClick(suggestion)}
                                    >
                                        {suggestion}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        :
                        messages.map((message) => (
                            <div key={message.id} className={classnames(styles['message'], styles[`message-${message.role}`])}>
                                {
                                    message.role === 'assistant' && message.pending ?
                                        <div className={styles['message-bubble']}>
                                            <div className={styles['typing-indicator']}>
                                                <div className={styles['dot']} />
                                                <div className={styles['dot']} />
                                                <div className={styles['dot']} />
                                            </div>
                                        </div>
                                        :
                                        <div className={styles['message-bubble']}>{message.text}</div>
                                }
                                {
                                    message.role === 'assistant' && !message.pending && Array.isArray(message.items) && message.items.length > 0 ?
                                        <HorizontalScroll className={styles['results-row']}>
                                            {message.items.map((item) => (
                                                <MetaItem
                                                    key={`${item.type}-${item.id}`}
                                                    className={styles['result-item']}
                                                    type={item.type}
                                                    name={item.name}
                                                    poster={item.poster}
                                                    posterShape={item.posterShape}
                                                    deepLinks={item.deepLinks}
                                                    trailerStreams={item.trailerStreams}
                                                    releaseInfo={item.releaseInfo}
                                                    badgeLabel={item.matchReason}
                                                />
                                            ))}
                                        </HorizontalScroll>
                                        :
                                        null
                                }
                            </div>
                        ))
                }
            </div>
            <div className={styles['input-row']}>
                <TextInput
                    className={styles['input']}
                    value={inputValue}
                    onChange={onInputChange}
                    onSubmit={onSubmit}
                    placeholder={'Ask for a recommendation...'}
                    disabled={isPending}
                />
                <Button
                    className={classnames(styles['send-button'], { 'disabled': isPending || inputValue.trim().length === 0 })}
                    title={'Send'}
                    onClick={onSubmit}
                >
                    <Icon className={styles['icon']} name={'arrow-up'} />
                </Button>
            </div>
            {
                supabaseUser !== null ?
                    <div className={styles['persist-note']}>Saved automatically - pick this conversation back up anytime from the chat icon.</div>
                    :
                    null
            }
        </div>
    );
};

ChatPanel.propTypes = {
    className: PropTypes.string,
    compact: PropTypes.bool,
    closeChatPanel: PropTypes.func,
    onExpand: PropTypes.func
};

module.exports = ChatPanel;
