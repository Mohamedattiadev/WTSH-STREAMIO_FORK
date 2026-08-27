// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { withCoreSuspender } = require('stremio/common');
const { MainNavBars } = require('stremio/components');
const ChatPanel = require('./ChatPanel');
const styles = require('./styles');

const Chat = () => {
    return (
        <MainNavBars className={styles['chat-container']} route={'chat'}>
            <ChatPanel className={styles['chat-panel']} />
        </MainNavBars>
    );
};

const ChatFallback = () => {
    return <MainNavBars className={styles['chat-container']} route={'chat'} />;
};

module.exports = withCoreSuspender(Chat, ChatFallback);
