// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const useSearch = require('stremio/routes/Search/useSearch');
const useSupabaseAuth = require('stremio/common/Supabase/useSupabaseAuth');
const useCalendarReminders = require('stremio/common/Supabase/useCalendarReminders');
const useGeminiApiKey = require('stremio/common/useGeminiApiKey');
const { getSupabaseClient } = require('stremio/common/Supabase/supabaseClient');
const { parseQuery, extractGenres, resolveReferenceItem, retrieveCandidates } = require('./retrieval');
const { generateAnswer } = require('./answerGenerator');

const NO_ADDONS_TEXT = 'You don\'t have any addons installed that support search yet. Install one from the Addons page to get recommendations here.';

// Drives the chat message list and the (up to two-stage) catalog retrieval
// pipeline behind it, reusing the same `useSearch` hook/model as the Search
// route and the Player's SearchPanel - including its batching/throttling.
//
// A query with a "like <title>" reference runs in two sequential stages
// (the shared `search` core model only supports one query in flight at a
// time, so this can't be parallelized):
//   1. "reference"  - search for the reference title itself, to resolve it
//                     against the catalogs and read its genres from `links`.
//   2. "candidates" - search using the resolved genre (or the query's own
//                     free text) to gather a broader, genre-relevant pool,
//                     then rank it via retrieveCandidates().
// A query without a reference goes straight to stage "candidates".
const useChatSession = () => {
    const { user } = useSupabaseAuth();
    const { addReminder } = useCalendarReminders(user);
    const { apiKey: geminiApiKey } = useGeminiApiKey();
    const [messages, setMessages] = React.useState([]);
    const [inputValue, setInputValue] = React.useState('');
    const [pendingQuery, setPendingQuery] = React.useState(null);
    const idRef = React.useRef(0);
    const historyLoadedForUserRef = React.useRef(null);

    // Real persisted history - loaded once per signed-in user, so it survives a refresh/new
    // device. Only text/role are stored (matches the chat_messages schema); the result cards
    // under an assistant message are always freshly re-derived from real catalogs, never stored,
    // so a loaded history entry never shows stale/since-uninstalled-addon items.
    React.useEffect(() => {
        if (user === null || historyLoadedForUserRef.current === user.id) {
            return;
        }

        historyLoadedForUserRef.current = user.id;
        const supabase = getSupabaseClient();
        supabase
            .from('chat_messages')
            .select('id, role, content, created_at')
            .order('created_at', { ascending: true })
            .then(({ data, error }) => {
                if (error || !Array.isArray(data) || data.length === 0) {
                    return;
                }

                setMessages((prev) => (prev.length > 0 ? prev : data.map((row) => ({
                    id: row.id,
                    role: row.role,
                    text: row.content,
                    items: []
                }))));
            });
    }, [user]);

    const persistMessage = React.useCallback((role, content) => {
        if (user === null) {
            return;
        }

        const supabase = getSupabaseClient();
        supabase.from('chat_messages').insert({ user_id: user.id, role, content }).then(({ error }) => {
            if (error) {
                console.error('Failed to persist chat message', error);
            }
        });
    }, [user]);

    const queryParams = React.useMemo(() => {
        const params = new URLSearchParams();
        if (pendingQuery !== null && typeof pendingQuery.searchTerm === 'string' && pendingQuery.searchTerm.length > 0) {
            params.set('search', pendingQuery.searchTerm);
        }
        return params;
    }, [pendingQuery]);

    const [search] = useSearch(queryParams);

    // Which query the currently-visible `search.catalogs` actually belong to
    // (mirrors Search.js) - guards against reading stale results from the
    // previous stage/turn while a new Load is still in flight.
    const currentSearchTerm = React.useMemo(() => {
        return search.selected !== null ?
            search.selected.extra.reduceRight((value, [name, extraValue]) => name === 'search' ? extraValue : value, null)
            :
            null;
    }, [search.selected]);

    const settled = React.useMemo(() => {
        return search.catalogs.length === 0 || search.catalogs.every((catalog) => (
            catalog.content?.type === 'Ready' || catalog.content?.type === 'Err'
        ));
    }, [search.catalogs]);

    React.useEffect(() => {
        if (pendingQuery === null || !settled || currentSearchTerm !== pendingQuery.searchTerm) {
            return;
        }

        let cancelled = false;
        const items = search.catalogs
            .filter((catalog) => catalog.content?.type === 'Ready')
            .flatMap((catalog) => catalog.content.content.map((item) => ({ ...item, sourceLabel: catalog.label ?? catalog.name ?? null })));

        if (pendingQuery.stage === 'reference') {
            const referenceItem = resolveReferenceItem(items, pendingQuery.parsed.referenceTitle);
            const referenceGenres = referenceItem !== null ? extractGenres(referenceItem) : [];
            const nextTerm = pendingQuery.parsed.genres[0]
                ?? referenceGenres[0]
                ?? (pendingQuery.parsed.freeText.length > 0 ? pendingQuery.parsed.freeText : null)
                ?? pendingQuery.parsed.referenceTitle;

            setPendingQuery((prev) => (prev !== null && prev.messageId === pendingQuery.messageId ? {
                ...prev,
                stage: 'candidates',
                referenceItem,
                searchTerm: nextTerm
            } : prev));
            return undefined;
        }

        const noAddons = search.catalogs.length === 0;
        const candidates = noAddons ? [] : retrieveCandidates(pendingQuery.parsed, items, pendingQuery.referenceItem);

        (async () => {
            const answer = noAddons ?
                { text: NO_ADDONS_TEXT, items: [] }
                :
                await generateAnswer({ query: pendingQuery.originalQuery, parsedQuery: pendingQuery.parsed, candidates, apiKey: geminiApiKey });

            if (cancelled) {
                return;
            }

            setMessages((prev) => prev.map((message) => (
                message.id === pendingQuery.messageId ?
                    { ...message, pending: false, text: answer.text, items: answer.items }
                    :
                    message
            )));
            persistMessage('assistant', answer.text);

            // Real write-through for the scheduling the LLM extracted (e.g. "I'll watch X on
            // Friday") - through the same real calendar_events table a manual reminder uses,
            // never a fake confirmation (the model itself is instructed to never claim it saved
            // anything - see api/chat.js). Silently a no-op when signed out.
            if (answer.scheduling && user !== null) {
                const matchedItem = candidates.find((item) => item.name === answer.scheduling.title);
                addReminder(answer.scheduling.title, answer.scheduling.date, 'chat', matchedItem?.poster ?? null);
            }

            setPendingQuery((prev) => (prev !== null && prev.messageId === pendingQuery.messageId ? null : prev));
        })();

        return () => {
            cancelled = true;
        };
    }, [pendingQuery, settled, currentSearchTerm, search.catalogs, persistMessage, user, addReminder]);

    const sendMessage = React.useCallback((text) => {
        const trimmed = typeof text === 'string' ? text.trim() : '';
        if (trimmed.length === 0 || pendingQuery !== null) {
            return;
        }

        const parsed = parseQuery(trimmed);
        const userMessageId = `msg-${++idRef.current}`;
        const assistantMessageId = `msg-${++idRef.current}`;

        setMessages((prev) => [
            ...prev,
            { id: userMessageId, role: 'user', text: trimmed },
            { id: assistantMessageId, role: 'assistant', text: '', items: [], pending: true }
        ]);
        persistMessage('user', trimmed);

        const initialTerm = parsed.referenceTitle
            ?? parsed.genres[0]
            ?? (parsed.freeText.length > 0 ? parsed.freeText : trimmed);

        setPendingQuery({
            parsed,
            originalQuery: trimmed,
            stage: parsed.referenceTitle !== null ? 'reference' : 'candidates',
            referenceItem: null,
            searchTerm: initialTerm,
            messageId: assistantMessageId
        });
        setInputValue('');
    }, [pendingQuery, persistMessage]);

    return {
        messages,
        inputValue,
        setInputValue,
        sendMessage,
        isPending: pendingQuery !== null
    };
};

module.exports = useChatSession;
