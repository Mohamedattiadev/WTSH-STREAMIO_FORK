// Copyright (C) 2017-2026 Smart code 203358507

// OPTIONAL durable object store backed by a Telegram bot + one chat you control. Off unless
// TELEGRAM_STORAGE_ENABLED=true (or OBJECT_STORAGE=telegram).
//
// USE IT ONLY FOR large, static, rarely-read blobs (e.g. a subtitle file fetched once and then
// served for a month). The win there is "don't re-download hundreds of KB". For hot JSON it is
// the WRONG tool: every read is a sendDocument -> getFile -> file-download round trip through
// Telegram's infra (~300 ms-2 s), slower than just re-hitting the source, and downloads cap at
// 20 MB with ~20 messages/min to one chat. Redis alone is the right hot cache; if you outgrow
// this niche, Vercel Blob is a simpler, faster durable store than Telegram.
//
// The bot token is read from the server environment only and is never placed in a returned
// reference, a URL, a response body, or anything the Stremio client can see.

const { fetchWithTimeout } = require('../http');

const TG_API = 'https://api.telegram.org';
const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = () => process.env.TELEGRAM_CHAT_ID || '';
const method = (name) => `${TG_API}/bot${token()}/${name}`;

const createTelegramStore = () => ({
    kind: 'telegram',
    get enabled() {
        return Boolean(token() && chatId());
    },

    // put(id, Buffer, { contentType }) -> reference object (safe to persist in redis)
    async put(id, buffer, { contentType = 'application/octet-stream' } = {}) {
        if (!this.enabled) return null;
        const safeName = String(id).replace(/[^\w.-]+/g, '_').slice(0, 96) || 'object';
        const form = new FormData();
        form.append('chat_id', chatId());
        form.append('caption', String(id).slice(0, 1024));
        form.append('document', new Blob([buffer], { type: contentType }), `${safeName}.bin`);

        const res = await fetchWithTimeout(method('sendDocument'), { method: 'POST', body: form }, 20000);
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok || !body.result) {
            throw new Error(`telegram sendDocument failed: ${res.status} ${JSON.stringify(body).slice(0, 180)}`);
        }
        const doc = body.result.document || {};
        return {
            storage: 'telegram',
            object_id: doc.file_id, // NOT the bot token - just an opaque Telegram file handle
            message_id: body.result.message_id,
            content_type: contentType,
            size: (buffer && buffer.length) || 0,
            created_at: new Date().toISOString(),
        };
    },

    // get(reference) -> { buffer, contentType } | null. getFile paths expire (~1h), so this
    // always re-resolves the download path rather than trusting a stored one.
    async get(ref) {
        if (!this.enabled || !ref || ref.storage !== 'telegram' || !ref.object_id) return null;

        const metaRes = await fetchWithTimeout(
            `${method('getFile')}?file_id=${encodeURIComponent(ref.object_id)}`,
            {},
            10000
        );
        const meta = await metaRes.json().catch(() => ({}));
        if (!metaRes.ok || !meta.ok || !meta.result || !meta.result.file_path) return null;

        const fileRes = await fetchWithTimeout(`${TG_API}/file/bot${token()}/${meta.result.file_path}`, {}, 20000);
        if (!fileRes.ok) return null;
        return {
            buffer: Buffer.from(await fileRes.arrayBuffer()),
            contentType: ref.content_type || 'application/octet-stream',
        };
    },

    async stat(ref) {
        if (!ref || ref.storage !== 'telegram') return null;
        return {
            storage: 'telegram',
            object_id: ref.object_id,
            size: ref.size,
            content_type: ref.content_type,
            created_at: ref.created_at,
        };
    },

    // Best-effort: a bot may only delete its own messages, and only for ~48h after posting.
    async del(ref) {
        if (!this.enabled || !ref || !ref.message_id) return false;
        const res = await fetchWithTimeout(
            method('deleteMessage'),
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId(), message_id: ref.message_id }),
            },
            10000
        ).catch(() => null);
        if (!res) return false;
        const body = await res.json().catch(() => ({}));
        return Boolean(body && body.ok);
    },
});

module.exports = { createTelegramStore };
