// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('stremio/components/Icon');
const { default: Button } = require('stremio/components/Button');
const ChatIcon = require('stremio/components/ChatIcon');
const { default: HorizontalScroll } = require('stremio/components/HorizontalScroll');
const MetaItem = require('stremio/components/MetaItem');
const { default: TextInput } = require('stremio/components/TextInput');
const useChatSession = require('../useChatSession');
const useSupabaseAuth = require('stremio/common/Supabase/useSupabaseAuth');
const styles = require('./styles');

const ChatPanel = ({ className, compact, popup, closeChatPanel, onExpand }) => {
    const { t } = useTranslation();
    const { messages, inputValue, setInputValue, sendMessage, isPending, pendingPhase } = useChatSession();
    const { user: supabaseUser } = useSupabaseAuth();
    const listRef = React.useRef(null);

    const SUGGESTIONS = [
        t('CHAT_SUGGESTION_FUNNY'),
        t('CHAT_SUGGESTION_SCIFI'),
        t('CHAT_SUGGESTION_ANIMATED')
    ];

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
        <div className={classnames(className, styles['chat-panel'], { [styles['compact']]: compact, [styles['popup']]: popup })}>
            <div className={styles['header']}>
                {
                    popup ?
                        null
                        :
                        <ChatIcon className={styles['header-icon']} />
                }
                <div className={styles['header-title']}>{t('CHAT_TITLE')}</div>
                <div className={styles['header-actions']}>
                    {
                        typeof onExpand === 'function' ?
                            <Button className={styles['close-button']} title={t('CHAT_OPEN_FULL')} onClick={onExpand}>
                                <Icon className={styles['icon']} name={'maximize'} />
                            </Button>
                            :
                            null
                    }
                    {
                        typeof closeChatPanel === 'function' ?
                            <Button className={styles['close-button']} title={t('BUTTON_CLOSE')} onClick={closeChatPanel}>
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
                            <div className={styles['empty-title']}>{t('CHAT_EMPTY_TITLE')}</div>
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
                                            {
                                                pendingPhase !== null && pendingPhase.phase === 'searching' ?
                                                    <div className={styles['progress-label']}>
                                                        {
                                                            pendingPhase.totalCount > 0 ?
                                                                `${t('CHAT_SEARCHING_ADDONS')} (${pendingPhase.settledCount}/${pendingPhase.totalCount})`
                                                                :
                                                                t('CHAT_SEARCHING_ADDONS')
                                                        }
                                                    </div>
                                                    :
                                                    null
                                            }
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
                                                    links={item.links}
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
                    placeholder={t('CHAT_INPUT_PLACEHOLDER')}
                    disabled={isPending}
                />
                <Button
                    className={classnames(styles['send-button'], { 'disabled': isPending || inputValue.trim().length === 0 })}
                    title={t('CHAT_SEND')}
                    onClick={onSubmit}
                >
                    <Icon className={styles['icon']} name={'arrow-up'} />
                </Button>
            </div>
            {
                supabaseUser !== null ?
                    <div className={styles['persist-note']}>{t('CHAT_PERSIST_NOTE')}</div>
                    :
                    null
            }
        </div>
    );
};

ChatPanel.propTypes = {
    className: PropTypes.string,
    compact: PropTypes.bool,
    popup: PropTypes.bool,
    closeChatPanel: PropTypes.func,
    onExpand: PropTypes.func
};

module.exports = ChatPanel;
