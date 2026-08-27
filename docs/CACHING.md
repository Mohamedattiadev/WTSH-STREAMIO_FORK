# Cache / proxy layer

A hot cache in front of every **server-side** upstream this app calls, so repeated requests are
answered from Redis (or memory) instead of re-hitting TMDB / OpenSubtitles / Internet Archive /
Cinemeta every time.

```
browser
  │  (unchanged: the WASM core still calls installed addons directly)
  ▼
Vercel functions in api/           ── api/reviews.js, api/hero-enrichment.js, api/addon/[...path].js
  │
  ▼
api/_lib/cache  ── getOrFetch(key, ttl, fetchFn)
  │        ├─ hit / stale-hit        → return cached (SWR refresh in background)
  │        ├─ in-process single-flight   (one warm instance)
  │        ├─ redis SET NX lock           (across instances, redis backend only)
  │        └─ negative-cache on failure   (don't hammer a broken upstream)
  ▼
Redis / Valkey  (hot cache)   ── Upstash REST in prod · Valkey+REST-shim locally · memory fallback
  │  miss
  ▼
authorized upstream  (TMDB · OpenSubtitles · Internet Archive · Cinemeta)
```

Nothing about how the Stremio client talks to addons changed. The `Cache-Control` / CDN headers
the addon function already set are kept — the CDN and this cache are complementary.

## Files

| File | Purpose |
| --- | --- |
| `api/_lib/cache/config.js` | Every tunable, read from env once. Defaults live here only. |
| `api/_lib/cache/keys.js` | Deterministic, normalised cache keys (`metadata:` / `catalog:` / `search:` / `streams:` / `subtitles:` / `idmap:`). |
| `api/_lib/cache/memory-backend.js` | In-process LRU+TTL store. Local dev default; fail-open fallback when Redis is down. |
| `api/_lib/cache/redis-backend.js` | Dependency-free client for the Upstash REST protocol (Upstash in prod, `serverless-redis-http` → Valkey locally). |
| `api/_lib/cache/index.js` | `getCache()` + `getOrFetch` — single-flight, SWR, negative cache, fail-open. |
| `api/_lib/cache/metrics.js` | Counters + latency reservoirs for `/api/cache-stats`. |
| `api/_lib/http.js` | `fetchWithTimeout`, `fetchJson`, and `assertAllowedUrl` (SSRF allow-list). |
| `api/_lib/wait-until.js` | Platform keep-alive for SWR background refreshes (`@vercel/functions` if installed, detached promise otherwise). |
| `api/_lib/object-store/` | Optional durable blob store. `nullStore` by default; `telegram.js` when enabled. |
| `api/_lib/tmdb.js` | `tmdbFind(imdbId)` — cached IMDb→TMDB id lookup, shared so the hero and the reviews row cost one `/find`, not two. |
| `api/cache-stats.js` | `GET /api/cache-stats` — hit rate, latency percentiles, dedup counts, cache size. Token-gated. |
| `api/board-hero.js` | `GET /api/board-hero?imdbId=&type=` — enrichment + reviews in one response; a fan-in over the same two cache entries, no duplicate storage. |
| `api/cron/prefetch.js` | `GET /api/cron/prefetch` — Vercel Cron warms the catalog rows every 6h. Off unless `PREFETCH_ENABLED=true` + `CRON_SECRET`. |
| `scripts/cache-benchmark.js` | `pnpm benchmark:cache` — before/after against a local synthetic upstream. |
| `tests/cache.test.js` | `pnpm test:cache`. |
| `docker-compose.yml` | Valkey + REST shim for local dev. |

## Environment

See `.env.example` for the annotated list. Everything is optional; with nothing set the layer
runs an in-process memory cache.

| Var | Default | Notes |
| --- | --- | --- |
| `CACHE_BACKEND` | auto | `redis` if both `UPSTASH_*` are set, else `memory`. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | – | Provisioned by "Upstash Redis" on the Vercel Marketplace. Locally: `http://localhost:8079` / `local-dev-token`. |
| `METADATA_CACHE_TTL` | `86400` | meta / hero-enrichment |
| `CATALOG_CACHE_TTL` | `21600` | catalog rows, reviews |
| `SEARCH_CACHE_TTL` | `1800` | catalog `search=` pages |
| `STREAM_CACHE_TTL` | `300` | (reserved; IA lookups use `CATALOG_CACHE_TTL`) |
| `SUBTITLE_CACHE_TTL` | `86400` | OpenSubtitles search |
| `IMAGE_CACHE_TTL` | `604800` | blob-store references |
| `ID_MAP_CACHE_TTL` | `2592000` | `tmdbId → imdbId` (SWR off; ~immutable) |
| `CACHE_SWR_ENABLED` | `true` | serve stale + refresh in background |
| `CACHE_SWR_GRACE_RATIO` | `1` | extra keep-alive past TTL, as a multiple of the TTL |
| `CACHE_SINGLEFLIGHT_LOCK` | `true` | cross-instance coalescing (redis only) |
| `CACHE_NEGATIVE_TTL` | `30` | seconds a failed upstream is "don't retry yet" |
| `CACHE_STATS_TOKEN` | – | required to enable `/api/cache-stats` |
| `CACHE_ALLOW_BYPASS` | `false` | lets `?nocache=1` skip the cache (benchmark only) |
| `TELEGRAM_STORAGE_ENABLED` | `false` | optional blob store, see below |

## Running locally

```bash
# memory cache, zero setup
pnpm start                       # or: vercel dev

# with a real Redis (Valkey) hot cache
docker compose up -d
#   .env / .env.local:
#     UPSTASH_REDIS_REST_URL=http://localhost:8079
#     UPSTASH_REDIS_REST_TOKEN=local-dev-token
vercel dev                       # serverless fns; `pnpm start` re-hosts them too

pnpm test:cache
pnpm benchmark:cache
docker compose down              # volume kept; `down -v` to wipe
```

`/api/cache-stats` (set `CACHE_STATS_TOKEN` first):

```bash
curl -s 'http://localhost:8080/api/cache-stats?token=YOUR_TOKEN' | jq
curl -s 'http://localhost:8080/api/cache-stats?token=YOUR_TOKEN&reset=1'   # clear this instance's counters
```

## Production (Vercel)

1. Project → **Storage** → add **Upstash Redis** (Marketplace). It injects `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN` automatically — nothing else to wire.
2. Optionally set any `*_CACHE_TTL` overrides and `CACHE_STATS_TOKEN` in Project → Settings →
   Environment Variables.
3. Deploy. `CACHE_BACKEND` flips to `redis` on its own.

Redis is never exposed publicly — the REST endpoint is token-authenticated and only the Vercel
functions hold the token. `/api/cache-stats` is a 403 until `CACHE_STATS_TOKEN` is set and
returns no secrets. All caller-influenced fetches go through the `assertAllowedUrl` host
allow-list (SSRF guard).

## Telegram object store (optional, off by default)

A Telegram bot + one chat you own, used **only** as a blob store for large static files (subtitle
files). Redis keeps a tiny reference; Telegram keeps the bytes.

**It is a poor fit for hot JSON.** Every read is `sendDocument → getFile → file-download`
(~300 ms–2 s), slower than re-fetching the source, with a 20 MB download cap and ~20
messages/min to one chat. Redis alone is the right hot cache. If you outgrow the
"persist subtitle files off-Redis" niche, **Vercel Blob** is a simpler, faster durable store.

Setup (credentials never reach the client; the bot token is server-side only):

1. Telegram → message **@BotFather** → `/newbot` → copy the token → `TELEGRAM_BOT_TOKEN`.
2. Create a **private** channel or group you own; add the bot as an admin.
3. Get that chat's id (e.g. forward a message to **@userinfobot**, or read `getUpdates`) →
   `TELEGRAM_CHAT_ID` (looks like `-1001234567890`).
4. Set `TELEGRAM_STORAGE_ENABLED=true` (or `OBJECT_STORAGE=telegram`).

## Benchmark (measured on this machine)

Synthetic upstream at 120 ms latency, 1000 requests, concurrency 50, 20 distinct keys
(`pnpm benchmark:cache`):

| Scenario | p50 | p95 | p99 | req/s | upstream calls |
| --- | --- | --- | --- | --- | --- |
| WITHOUT cache (→ upstream every time) | 161 ms | 284 ms | 360 ms | 267 | 1000 |
| WITH cache, **memory** backend | 0.12 ms | 132 ms | 157 ms | 5871 | **20** |
| WITH cache, **Valkey via local REST shim** | 138 ms | 762 ms | 972 ms | 271 | **20** |

- **Upstream calls: −98%** on both backends. Cold stampede: 50 identical concurrent requests →
  **1** upstream call.
- The memory row is what a warm serverless instance's own hit path looks like.
- The REST-shim row includes a Docker double hop (client → Node shim → Valkey) **and** the
  coalescing lock's poll loop — production Upstash (HTTP/2 keep-alive, region-local) sits between
  the two. Tune `CACHE_LOCK_POLL_MS` down if waiter latency on misses matters more than lock
  chatter.

## Known limits / next steps

- Cross-instance dedup relies on a Redis `SET NX` lock; waiters poll every `CACHE_LOCK_POLL_MS`.
  A pub/sub wakeup would cut miss-path tail latency.
- `/api/cache-stats` latency percentiles are per-instance; the counters are Redis-aggregated
  (buffered per request and flushed as one `/pipeline` call).
- Not built (deferred): a Stremio addon-protocol reverse proxy (would let Cinemeta / third-party
  addon responses be cached server-side too, at the cost of rewriting every installed addon's
  `transportUrl`).

### Done since the first pass

- **MGET batching** — the catalog page's `tmdbId → imdbId` lookups are read in one Redis `MGET`
  instead of ~20 sequential GETs. Warm catalog page: ~139 ms → ~24 ms.
- **Background prefetch** — `api/cron/prefetch.js` + a `vercel.json` cron warms the 10 catalog
  rows every 6h so the first visitor after a TTL expiry gets a hit. Off by default.
- **`waitUntil`** — `reviews.js`, `hero-enrichment.js` and the addon pass `api/_lib/wait-until`
  into `getOrFetch`, so SWR refreshes finish on the platform keep-alive when `@vercel/functions`
  is installed (detached-promise fallback otherwise).
- **Pipelined stat counters** — a request bumps 3-5 counters; these are buffered and shipped to
  Redis as one `/pipeline` call at the start of the next request, instead of one `INCRBY` each.
- **Shared `/find` + `/api/board-hero`** — `reviews.js` and `hero-enrichment.js` both resolve the
  IMDb id through one cached `tmdbFind` (coalesced), and `/api/board-hero` returns both payloads
  in one request as a fan-in over the same cache entries. Client can adopt it to drop a round
  trip; the two standalone endpoints keep working.
