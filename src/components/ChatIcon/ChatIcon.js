// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');

// The shared @stremio/stremio-icons set has no chat/message icon at all (134
// icons total, checked node_modules/@stremio/stremio-icons/jade/icons.jade),
// and critically 'help' - what the Chat nav tab was using as a stand-in -
// has no 'help-outline' variant either. NavTabButton always requests
// `${icon}-outline` while a tab is unselected, so the Chat tab was rendering
// nothing for that state (only showing an icon while already on the Chat
// page). This is a dedicated icon instead, same 512x512 viewBox and
// currentcolor convention as the shared set so it themes identically
// (color, hover, selected state all still driven by CSS).
const ChatIcon = ({ className, outline }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className}>
        {
            outline ?
                <>
                    <rect x="48" y="80" width="416" height="288" rx="56" stroke="currentcolor" strokeWidth="32" fill="none" />
                    <path d="M128 368 96 456 184 368Z" stroke="currentcolor" strokeWidth="32" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                    <circle cx="160" cy="224" r="20" fill="currentcolor" />
                    <circle cx="256" cy="224" r="20" fill="currentcolor" />
                    <circle cx="352" cy="224" r="20" fill="currentcolor" />
                </>
                :
                <>
                    <rect x="48" y="80" width="416" height="288" rx="56" fill="currentcolor" />
                    <path d="M128 368 96 456 184 368Z" fill="currentcolor" />
                </>
        }
    </svg>
);

ChatIcon.propTypes = {
    className: PropTypes.string,
    outline: PropTypes.bool
};

module.exports = ChatIcon;
