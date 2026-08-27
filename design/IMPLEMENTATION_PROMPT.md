# Implement the Ember Rail redesign for real, with persistence, and deploy it

## Context

This repo (`streamio-ati-version`) is a Stremio web-client fork. Over a long design session, we built a full UI/UX redesign as a static HTML/CSS/JS mockup ("Ember Rail"), covering every page: Board, Discover, Library, Chat ("Ask WTS"), Calendar, Addons, Settings, Search, and a new Player screen.

**The mockup file is checked into this repo at `design/ember-rail-mockup.html`.** That's the single source of truth — read it end to end (the HTML structure, the `<style>` block, and the `<script>` block) before writing any code. Do not guess at colors, spacing, or component behavior; read it directly. (It was also published as a Claude Artifact during the design session, but that link is tied to a specific account/session and may not resolve here — the repo file is the reliable copy. If you want to see it rendered instead of just reading source, you can open the local file in a browser or re-publish it as a fresh Artifact from this session.)

## What "done" looks like

The real app (`src/`) visually and functionally matches the mockup:
- New shell: a flush, edge-to-edge, collapsible icon rail (replaces `VerticalNavBar`) + a flat, unified top bar (replaces `HorizontalNavBar`) — ember/near-black palette, `Unbounded` display font + `Manrope` body + `IBM Plex Mono` for data/labels (see the mockup's `<link>` and font-family rules for exact weights).
- Every real route (`src/routes/Board`, `Discover`, `Library`, `Chat`, `Calendar`, `Addons`, `Settings`, `Search`, `Player`) restyled to match its mockup counterpart, **without changing the underlying data/model logic** — these routes already dispatch real actions to `stremio-core` (`useCore`, `useModelState`, etc.); only presentation changes.
- New shared pieces the mockup introduced that don't exist yet in the real app: a unified poster hover-trailer button + preview panel pattern (Discover/Library/Search/Calendar), a Notification Center (bell + dropdown), a floating chat launcher + popup mini-chat, and a real Player/Watch screen with the control layout from the mockup (skip ±10s flanking the center play button, speed/quality chips, PiP, subtitles/audio, Up Next floating over the video).
- Card action buttons never overflow or wrap internally, in any viewport — the mockup's fix (`flex-wrap: wrap` on button rows, `white-space: nowrap` + `flex: none` on every button) is the pattern to replicate everywhere in the real components, not just where the mockup happened to show it.
- Full responsiveness: the mockup's three tiers (desktop / ~1180px tablet / ~720px phone, where the rail becomes a bottom tab bar) should be replicated with real CSS (Less) container queries or media queries matching the app's existing `screen-sizes.less` breakpoints — reconcile the mockup's arbitrary breakpoints with whatever this repo already standardizes on.

## Phase 1 — Design tokens & shell

1. Read `src/common/screen-sizes.less` and any existing color/token files (`@stremio/stremio-colors`) to see what's already centralized vs. hardcoded per-component.
2. Introduce the new palette as tokens (CSS custom properties or Less variables, matching whatever convention already exists) rather than hardcoding hex values in every component: the ember accent (`#FF5F36`/`#FF3D2E` gradient), the near-black surfaces (`#0C0A0C`/`#141013`/`#1D1417`), the `IBM Plex Mono` mono usage for badges/timestamps.
3. Rewrite `src/components/NavBar/VerticalNavBar` and `src/components/NavBar/HorizontalNavBar` (and their `styles.less`) to match the mockup's rail/top-bar exactly: collapse/expand toggle with persisted state (the mockup uses `localStorage`; decide whether this app has an existing settings-persistence mechanism to use instead — check `src/common` for a `useBinaryState`/persistence helper before reaching for raw `localStorage`).
4. Wire real active-route highlighting (the mockup's sliding indicator) using the router's current path instead of a hardcoded `TABS` array — check `src/components/MainNavBars/MainNavBars.tsx`, keep it as the composition point but restyle.

**Checkpoint**: show me the new shell running via the `run` skill/dev server before moving to Phase 2. Don't proceed on a shell that doesn't visually match.

## Phase 2 — Page-by-page port

Go route by route. For each: read the existing route component fully, identify what real data it renders (filters, catalogs, library items, addon list, settings sections, etc.), then restyle to match the mockup's version of that page **using the real data**, not the mockup's placeholder titles. Preserve every existing feature (filters, sort, pagination, install/uninstall, etc.) — this is a reskin, not a rewrite of behavior.

Order: Board → Discover → Library → Addons → Settings → Calendar → Search → Chat → Player last (Phase 3, it's mostly new).

For Discover/Library/Search: port the poster-grid + hover preview-panel pattern from the mockup. For Calendar: port the compact day grid + hover-to-preview + "Upcoming" list styled as announcement cards.

**Checkpoint** after every 2–3 routes — don't silently plow through all of them in one shot.

## Phase 3 — New features

1. **Trailer button + modal**: every poster gets the mockup's centered "▶ Trailer" pill on hover; clicking opens a modal with backdrop, title, tags, rating, synopsis, Watch Now / + Library / Not Now. Trailer content is a placeholder visual (no real trailer video source exists) — keep it that way unless you find the app already has a trailer source (check addon manifests for a trailer stream type) worth wiring in for real.
2. **Player screen**: build a real route (or a full-screen overlay reachable from Play/Resume actions) matching the mockup's control layout, wired to whatever video-playback mechanism this app already uses (check `src/routes/Player` — there is likely an existing player route/engine already; **reskin that existing player, do not build video playback from scratch**).
3. **Notification Center**: bell + dropdown panel, numbered unread badge, "Mark all read". Seed it from anything the app can meaningfully notify about right now (new addon installed, library item finished, etc.) — ask me if it's unclear what real events should populate it before inventing fake ones.
4. **Chat ("Ask WTS")**: this is meant to be a real LLM-backed feature, not just UI — wire it to the Claude API (Anthropic). Check whether `src/routes/Chat` already has any backend wiring first. Since the API key must never be exposed client-side, this needs a small server-side proxy: either a Vercel serverless function (`api/chat.ts` or similar) or a Supabase Edge Function, called from the client instead of hitting the Anthropic API directly. Give the assistant access to the user's real library/catalog context (not the mockup's hardcoded example titles) so recommendations are genuinely relevant. Load the `claude-api` skill in this harness for current model IDs, pricing, and request/response shape before writing the integration.
5. **Chat → Calendar scheduling**: the mockup demonstrates this with regex keyword parsing ("I'll watch X on Friday" → adds a calendar entry) against a hardcoded title list — that will not work against real user libraries. Since Chat is now a real LLM feature (see above), have the same backend call extract `{title, date}` as structured output (e.g. tool use / a JSON response format) instead of regex, matched against the user's real library/catalog, then write the resulting event through the same `calendar_events` insert path a manual calendar entry would use.

## Phase 4 — Real persistence (Supabase)

Goal: you and your friends each sign in with your own separate account (not a shared login) and your library additions, calendar entries, chat history, and notifications persist across sessions and devices instead of resetting.

1. Create a Supabase project (you'll need to do this yourself at supabase.com — I can't create accounts on your behalf). Give me the project URL and anon key once created (anon key is safe to embed client-side; never share the service-role key with me or commit it anywhere).
2. Add `@supabase/supabase-js` as a dependency.
3. Schema (adjust once we confirm what's real vs. mockup-only in Phase 3):
   - `profiles` (id uuid references auth.users, display_name, avatar_url)
   - `calendar_events` (id, user_id, title, poster_ref, scheduled_for date, source enum['manual','chat'], created_at)
   - `notifications` (id, user_id, body, read boolean, created_at)
   - `chat_messages` (id, user_id, role enum['user','assistant'], content, created_at)
4. Enable Row Level Security on every table, policy: users can only read/write their own rows.
5. Wire Supabase Auth (ask me email/password vs. magic link — either is fine, just confirm before building the sign-in screen) into `Settings` (replace/extend the existing account section) and gate the app shell behind real per-user sign-in.
6. Replace any client-side-only state for library/calendar/notifications with real reads/writes to Supabase, with optimistic UI updates and loading/error states — don't silently swallow failures.

**Do not proceed past this phase without me confirming the schema** — get it wrong and we're doing a migration later.

## Phase 5 — Fix the broken deploy, then ship to Vercel

1. This is a webpack SPA (not Next.js) — full client-side routing. Before touching Vercel, check `webpack.config.js` / build output for `publicPath` and confirm the production build's `index.html` references assets with a single leading `/`, not `//`. That double-slash is almost certainly why the earlier deploy showed a broken `https://.../..//..`-style URL.
2. Add a `vercel.json` with a catch-all rewrite (`{ "source": "/(.*)", "destination": "/index.html" }`) so client-side routes don't 404 on refresh — a router-based SPA on Vercel needs this explicitly.
3. Set Supabase URL/anon key **and** the Anthropic API key as Vercel environment variables (not hardcoded in source) — the Anthropic key must only ever be read server-side, inside whichever serverless function proxies the chat calls.
4. Run `vercel login` (interactive — I'll prompt you to do this yourself, I cannot authenticate as you) and `vercel` to deploy a preview first. **Confirm the preview works — real sign-in, real data persistence, every route, all three responsive tiers — before promoting to production.**
5. For the project name / domain: attempt to name the Vercel project `wts` so it gets `wts.vercel.app`; if that subdomain is already taken by someone else's project, tell me immediately with the alternatives Vercel offers rather than silently picking one.

## Ground rules for the session

- Checkpoint after each phase. Do not silently barrel through all five phases in one uninterrupted run — this is exactly the kind of large, hard-to-review change that needs incremental confirmation.
- Never invent backend behavior (fake LLM responses, fake data sources) and ship it as if it were real — if Phase 3 surfaces something that needs a real service and none exists, stop and ask.
- Treat Supabase keys, Vercel auth, and any other credentials as things you request from the user and use, never things you generate or guess.
- Match the *existing* codebase's conventions (CommonJS `require`, `.less` modules, `useTranslate`, the `stremio-core` dispatch pattern) — the mockup is a visual/interaction spec only, not a code source to copy-paste.
