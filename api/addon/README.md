# WTSH — Subtitles & Catalogs addon

A first-party Stremio addon served straight from this Vercel deployment. No separate host, no
account, no token in any URL. It returns **no streams** and cannot surface an unlicensed source,
which is why `src/common/useAutoInstallEssentialAddons.js` is allowed to install it silently on
first run.

Single serverless function: [`[...path].js`](./[...path].js).

## Endpoints

| Route | What it does |
| --- | --- |
| `GET /api/addon/manifest.json` | Addon manifest. `catalog` is only advertised when `TMDB_API_KEY` is set. |
| `GET /api/addon/subtitles/{type}/{id}/{extra}.json` | Subtitle list. `id` is `tt1234567` or `tt1234567:1:2` (series S1E2). `extra` may carry `videoHash` + `videoSize` (the streaming server's OpenSubtitles hash). |
| `GET /api/addon/catalog/{type}/{catalogId}/{extra}.json` | TMDB browse row. `extra` may carry `skip`, `search`, `genre`. |
| `GET /api/addon/osfile/{base64url}.srt` | Internal proxy: fetches one subtitle from `dl.opensubtitles.org`, unzips it, guarantees UTF-8, serves `application/x-subrip`. |

The `/addon/*` alias in `vercel.json` maps to the same function, so the manifest also resolves at
`https://<domain>/addon/manifest.json`.

## Subtitles

- **Search** — `api.opensubtitles.com/api/v1/subtitles` (public). Three parallel queries per
  request: a broad "all languages, most-downloaded first" query, an `ar,tr` query so Arabic and
  Turkish are always represented, and — when the streaming server computed one — a `moviehash`
  query whose `moviehash_match` hits sort to the very top (frame-accurate sync).
- **Ranking** — Arabic → English → Turkish first, then hash-matched, then human (not
  AI/machine-translated), then trusted uploader, then download count.
- **Download** — always keyless via `dl.opensubtitles.org/en/download/subencoding-utf8/sub/<legacy id>`
  (a UTF-8 ZIP, no per-key quota). The proxy response is CDN-cached `immutable` for a month, so
  each distinct subtitle is pulled from OpenSubtitles at most once a month across every user.
- `rest.opensubtitles.org` — the old keyless endpoint Stremio's own OpenSubtitles addon used —
  is **dead** as of 2026 (302s to a broken host); that's why this uses `.com` search + `.org`
  download instead.

### `OPENSUBTITLES_API_KEY` (optional, recommended)

Server-side env var, never sent to the client or put in a URL. Without it, search runs
unauthenticated and `opensubtitles.com` rate-limits it hard from a busy egress IP
(`403 "You cannot consume this service"`), so results get spotty. With it, search is reliable.
Downloads never need it.

Get one free: sign in at <https://www.opensubtitles.com>, open **Consumers**, **New consumer**,
copy the **Api Key**. Add it in Vercel → Project → Settings → Environment Variables (and in
`.env.local` for local `vercel dev`).

## Catalogs (TMDB)

Reuses the same `TMDB_API_KEY` that `api/reviews.js` and `api/hero-enrichment.js` already read.
Ten rows — Trending / Popular / Arabic / Turkish / Anime, each in movie and series form. Arabic
and Turkish rows filter on TMDB's `with_original_language` and pull localized titles/overviews.

Every catalog item is resolved to its real **IMDb id** (`tt…`) via TMDB `external_ids`, so:

- other installed addons can still resolve streams for these titles, and
- Cinemeta still owns the detail page (this addon deliberately does **not** serve `meta`).

Items with no IMDb id (some anime, very new titles) are dropped from the row.

## Local testing

`vercel dev` runs the function locally. Or exercise it directly with Node — see the ad-hoc
harnesses used during development (mock `(req, res)`, call the exported handler, hit real
upstreams). Catalog needs `TMDB_API_KEY`; subtitle search needs `OPENSUBTITLES_API_KEY` to not
be rate-limited; `osfile` needs neither.
