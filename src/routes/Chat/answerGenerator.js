// Copyright (C) 2017-2026 Smart code 203358507

// Turns a parsed query + ranked candidates into a short natural-language answer.
//
// `generateAnswer` is the single call site the rest of the app uses. When an LLM answer is
// available it's used; on any failure (network, non-2xx, malformed response) this falls back
// to the rule-based generator rather than surfacing an error bubble - a recommendation
// degrading in tone is fine, the chat breaking outright is not.

const formatMinutes = (minutes) => {
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours}h ${rest}m`;
};

const describeAsk = (parsedQuery, count) => {
    const plural = count !== 1;
    if (parsedQuery.genres.length > 0) {
        return `${parsedQuery.genres.join(' & ')} ${plural ? 'titles' : 'title'}`;
    }
    if (parsedQuery.referenceTitle !== null) {
        return `title${plural ? 's' : ''} similar to ${parsedQuery.referenceTitle}`;
    }
    if (parsedQuery.freeText.length > 0) {
        return `match${plural ? 'es' : ''} for "${parsedQuery.freeText}"`;
    }
    return plural ? 'matches' : 'match';
};

/**
 * Phase 1 implementation: composes a short templated sentence from the
 * parsed query and the candidate count/top match. Never mentions an item
 * that isn't in `candidates`.
 */
const generateAnswerRuleBased = ({ parsedQuery, candidates }) => {
    const subject = describeAsk(parsedQuery, candidates.length);
    const runtimePhrase = parsedQuery.maxRuntimeMinutes !== null ? ` under ${formatMinutes(parsedQuery.maxRuntimeMinutes)}` : '';

    if (candidates.length === 0) {
        return {
            text: `I couldn't find any ${describeAsk(parsedQuery, 0)}${runtimePhrase} in your installed catalogs. Try a different phrasing, or install more addons for wider coverage.`,
            items: []
        };
    }

    const topNames = candidates.slice(0, 3).map((item) => item.name).filter(Boolean).join(', ');
    const text = `Found ${candidates.length} ${subject}${runtimePhrase} from your installed catalogs${topNames ? ` - including ${topNames}` : ''}:`;

    return { text, items: candidates };
};

// Calls the server-side proxy at api/chat.js (Gemini key never reaches the client - see that
// file's header comment). `candidates` is sent as-is and is the only set of titles the model is
// allowed to talk about; `items` in the returned object is always exactly `candidates`, never
// whatever the model happened to say, so a prompt-following failure can misdescribe an item but
// can never surface a title that wasn't actually in the user's installed catalogs.
//
// `scheduling` (a { title, date } the model extracted from something like "I'll watch X on
// Friday") is threaded through on the result but intentionally not written anywhere yet - real
// calendar-event storage needs the Supabase `calendar_events` table (Phase 4), which doesn't
// exist until that's set up. Once it does, the Chat route can write it through the same path a
// manual calendar entry would use; nothing else here needs to change.
// Formats the *client's* local wall-clock date as YYYY-MM-DD (Date's getFullYear/Month/Date
// accessors are local-time, unlike toISOString's UTC) - the server has no way to know the user's
// timezone on its own, and computing "today" from its own clock is wrong for a meaningful part of
// every day for anyone not in UTC (e.g. resolves to yesterday during the client's early-morning
// hours in any timezone ahead of UTC), which broke "I'll watch X on Friday"-style resolution.
const getLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const generateAnswerWithLlm = async ({ query, candidates }) => {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, candidates, todayDate: getLocalDateString() })
    });

    if (!response.ok) {
        throw new Error(`/api/chat returned ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.text !== 'string') {
        throw new Error('/api/chat response missing text');
    }

    return { text: data.text, items: candidates, scheduling: data.scheduling ?? null };
};

// The client can't know server-side Gemini key state ahead of a request - it always tries the
// LLM path and falls back on failure (including the proxy's own 503 when unconfigured), so this
// is deliberately always true rather than mirroring server config the client can't see.
const isLlmConfigured = () => true;

/**
 * Single call site for producing a chat answer. Tries the LLM path first when configured,
 * falling back to the rule-based generator on any failure.
 * @returns {Promise<{ text: string, items: object[], scheduling?: { title: string, date: string } | null }>}
 */
const generateAnswer = async ({ query, parsedQuery, candidates }) => {
    if (isLlmConfigured()) {
        try {
            return await generateAnswerWithLlm({ query, parsedQuery, candidates });
        } catch (error) {
            console.error('generateAnswerWithLlm failed, falling back to rule-based answer', error);
        }
    }
    return generateAnswerRuleBased({ parsedQuery, candidates });
};

module.exports = { generateAnswer, generateAnswerWithLlm, isLlmConfigured };
