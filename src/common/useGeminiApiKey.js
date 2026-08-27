// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');

// Lets a user (especially self-hosting this dev server, where GEMINI_API_KEY is never set)
// supply their own key from Settings instead of relying on api/chat.js's shared server key.
// Stored in localStorage only - answerGenerator.js sends it with each /api/chat request, and
// the server prefers it over process.env.GEMINI_API_KEY when present (see api/chat.js). It
// never reaches any origin other than this app's own /api/chat endpoint.
const STORAGE_KEY = 'stremio-gemini-api-key-v1';

const readStoredKey = () => {
    try {
        return window.localStorage.getItem(STORAGE_KEY) ?? '';
    } catch (e) {
        return '';
    }
};

const useGeminiApiKey = () => {
    const [apiKey, setApiKeyState] = React.useState(readStoredKey);

    const setApiKey = React.useCallback((value) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        try {
            if (trimmed.length > 0) {
                window.localStorage.setItem(STORAGE_KEY, trimmed);
            } else {
                window.localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            // localStorage unavailable (private mode, etc); still reflect it for this session
        }
        setApiKeyState(trimmed);
    }, []);

    return { apiKey, setApiKey };
};

module.exports = useGeminiApiKey;
