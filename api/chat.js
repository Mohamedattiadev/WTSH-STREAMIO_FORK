// Copyright (C) 2017-2026 Smart code 203358507

// Vercel serverless function - the only place GEMINI_API_KEY is ever read. The client
// (src/routes/Chat/answerGenerator.js) never sees this key; it only ever calls this endpoint.
//
// Input:  { query: string, candidates: Array<{ name, type, releaseInfo, runtime, matchReason }> }
// Output: { text: string, scheduling: { title: string, date: string } | null }
//
// `candidates` is the *complete and only* set of items this endpoint is allowed to talk about -
// it was already retrieved/ranked against the user's real installed addon catalogs in
// src/routes/Chat/retrieval.js before this function is ever called. The model is instructed to
// never mention a title outside that list, so a hallucinated recommendation is a prompt-following
// failure, not something this endpoint can itself invent by construction (it has no other titles
// available to it).

// gemini-2.5-flash returns 404 for new API keys as of this key's creation - Google's own error
// pointed at gemini-3.6-flash as the replacement (confirmed live against the real API, not
// assumed from training data, since model availability shifts faster than that).
const GEMINI_MODEL = 'gemini-3.6-flash';

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        text: {
            type: 'string',
            description: 'A short (1-3 sentence), friendly reply to the user, referencing only titles from CANDIDATES.'
        },
        scheduling: {
            type: 'object',
            nullable: true,
            description: 'Set only if the user clearly states they plan to watch one specific CANDIDATE title on a specific day/date. Otherwise omit/null.',
            properties: {
                title: { type: 'string', description: 'Must exactly match a CANDIDATES[].name.' },
                date: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD), resolved relative to TODAY_DATE.' }
            },
            required: ['title', 'date']
        }
    },
    required: ['text']
};

const buildPrompt = (query, candidates, todayDate) => {
    const candidateList = candidates.map((item, index) => (
        `${index + 1}. ${item.name} (${item.type}${item.releaseInfo ? `, ${item.releaseInfo}` : ''}${item.runtime ? `, ${item.runtime}` : ''})${item.matchReason ? ` - ${item.matchReason}` : ''}`
    )).join('\n');

    return `You are "Ask WTS", a movie/TV recommendation assistant embedded in a Stremio-based streaming app.
TODAY_DATE: ${todayDate}

CANDIDATES (the complete and ONLY set of titles you may reference or recommend - never mention, imply, or invent any title outside this list):
${candidateList.length > 0 ? candidateList : '(none - no matching titles were found in the user\'s installed addons)'}

USER MESSAGE: ${query}

Write a short, friendly reply. If CANDIDATES is empty, say so honestly and suggest trying different phrasing or installing more addons - do not recommend anything. Separately, only if the user's message clearly states they plan to watch one specific CANDIDATES title on a specific day or date (e.g. "I'll watch X on Friday", "remind me to watch Y tomorrow"), set "scheduling" to that title (must exactly match a CANDIDATES name) and the resolved ISO date. Otherwise leave scheduling unset. IMPORTANT: calendar/reminder saving is not implemented yet - never say or imply in "text" that you've scheduled, saved, added to a calendar, or set a reminder for anything, even when you do set "scheduling". Just acknowledge the plan conversationally (e.g. "Enjoy X on Friday!"), nothing more.`;
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
        return;
    }

    const { query, candidates, todayDate: clientTodayDate } = req.body ?? {};
    if (typeof query !== 'string' || !Array.isArray(candidates)) {
        res.status(400).json({ error: 'Expected { query: string, candidates: array }' });
        return;
    }

    // Prefer the client's own local date (see answerGenerator.js's getLocalDateString) - this
    // server has no reliable way to know the user's timezone otherwise, and its own UTC clock is
    // wrong for a meaningful stretch of every day for anyone not in UTC. Falls back to server
    // time only for a caller that doesn't send it (defense in depth, not the expected path).
    const todayDate = /^\d{4}-\d{2}-\d{2}$/.test(clientTodayDate) ?
        clientTodayDate
        :
        new Date().toISOString().slice(0, 10);
    const prompt = buildPrompt(query, candidates, todayDate);

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: RESPONSE_SCHEMA,
                        temperature: 0.4
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API error', geminiResponse.status, errorBody);
            res.status(502).json({ error: 'Upstream Gemini request failed' });
            return;
        }

        const geminiData = await geminiResponse.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof rawText !== 'string') {
            res.status(502).json({ error: 'Gemini response had no text' });
            return;
        }

        const parsed = JSON.parse(rawText);
        if (typeof parsed.text !== 'string') {
            res.status(502).json({ error: 'Gemini response failed schema validation' });
            return;
        }

        // Defense in depth: even though the model is instructed to only extract a scheduling
        // title that matches a real candidate, never trust it blindly - drop anything that
        // doesn't exactly match a name we actually sent, so a hallucinated title can never
        // reach the client as if it were a real match.
        const candidateNames = new Set(candidates.map((item) => item.name));
        const scheduling = parsed.scheduling && candidateNames.has(parsed.scheduling.title) ?
            parsed.scheduling
            :
            null;

        res.status(200).json({ text: parsed.text, scheduling });
    } catch (error) {
        console.error('chat proxy failed', error);
        res.status(500).json({ error: 'Internal error' });
    }
};
