# Continue the Ember Rail → WTSH redesign: remaining fixes

## Context

This repo (`streamio-ati-version`) is a Stremio web-client fork being redesigned into a new dark/ember-themed app now called **WTSH** (renamed from "WTS" this session — check for any remaining stray "WTS" mentions before assuming the rename is 100% complete). The visual/interaction source of truth is `design/ember-rail-mockup.html` — read it directly (HTML + `<style>` + `<script>`) before touching any styling; don't guess at colors/spacing from memory or descriptions.

Run the app locally with `pnpm start` (webpack-dev-server on `http://localhost:8080`). Respect the existing project convention: never leave more than one `pnpm start` running — always `fuser -k 8080/tcp` and confirm the port is free before restarting (a prior incident here caused an OOM that killed the user's other apps).

**Verification standard for this whole task**: don't just read code and assume it's fixed. For every change, actually load the affected page at `localhost:8080` (Playwright + a real browser binary, e.g. `/opt/brave-bin/brave` via `chromium.launch({ executablePath: ... })`, works well in this sandbox — plain `npx playwright install`'s bundled Chromium has had version-mismatch issues before) and confirm visually. Several bugs this session only became obvious under a real signed-in session with real catalog data — anonymous/empty-state testing hides a lot. To get a signed-in session: Settings → General → "Guest login" only bypasses the intro screen without creating a real account (Library/Calendar stay gated); use the real email/password **Sign up** flow instead (any disposable email works, e.g. `@mailinator.com`) to get a real `profile.auth.user` session for testing Library/Calendar/Settings' full authenticated state.

## What's already done this session (for context — don't redo)

Commits `3ebc629..1d65da7` on the `development` branch, in order:
1. Implemented the full Ember Rail redesign (shell, all pages, Chat with real Gemini LLM backend, Supabase persistence) — this was prior work, already committed.
2. Re-hosted `api/chat.js` on the webpack dev server so Chat's LLM path works under plain `pnpm start` without needing `vercel dev`.
3. Restyled Settings' account links to the mockup's chevron list-row pattern, grouped Trakt/Discord under a "Connections" header.
4. Fixed Chat's scheduling extraction (`retrieval.js`'s free-text matcher was one-directional, so "I'll watch X on Friday" almost never matched X in real catalogs) and a timezone bug in `api/chat.js` (server's UTC clock resolved "today" wrong for part of every day in non-UTC timezones — now uses the client's local date). Added a `Reminders` section to the Calendar page reading from Supabase's `calendar_events` table (the write path existed; nothing ever displayed it).
5. Fixed the chat FAB overlapping the bottom tab bar on mobile (breakpoint mismatch between components).
6. Fixed account email overflowing its Settings card on narrow viewports.
7. Fixed Addons' mobile "Add addon" button (a fixed-position pill) permanently obscuring card titles underneath it — shrunk to an icon-only FAB, moved off ChatFab's corner (they were overlapping by more than half their height).
8. **Major**: fixed wildly inconsistent card sizes across Discover/Library/Search grids. Root cause: `grid-template-columns: repeat(N, 1fr)` — a bare `1fr` is really `minmax(auto, 1fr)`, so one item's unshrinkable content (e.g. a long title) forces its whole column wider, and since all rows share column tracks, that constraint applies across the *entire* grid, not just the offending row. Fixed to `repeat(N, minmax(0, 1fr))` everywhere.
9. Fixed the account/notifications popup rendering *behind* the Board hero (a CSS stacking-context bug: neither the popup's anchor nor Hero's container establishes its own stacking context, so both z-index:1 elements competed at a shared ancestor's level, and Hero won on DOM order). Raised the popup's z-index.
10. Fixed the same root cause as #8 but via flexbox in Board's `MetaRow` carousels (`min-width:auto` default on flex items) — occasional oversized cards there too.
11. Renamed the app from WTS to WTSH throughout.
12. Fixed the sidebar collapse/expand toggle icon being nearly invisible at rest (too-low-contrast color on a tiny icon).
13. Sped up the rail's active-tab indicator transition (0.32s → 0.15s, felt sluggish).
14. Restyled the top search bar from a filled pill to the mockup's actual flat, underline-bordered treatment (confirmed directly against the mockup's `#topSearch` — it was never a pill there), moving the search glyph to the leading (left) position to match while keeping the real submit/clear button behavior intact.

A known, investigated-but-not-fixed detail: the router keeps a previous route's `MainNavBars`/`VerticalNavBar` instance mounted alongside the current one (bounded at ~2 instances, confirmed not an unbounded leak) — a page-wide DOM query can grab the stale instance, but the *currently visible* route's own indicator does track selection correctly. This is a router/mount-lifecycle detail; don't go refactor the router to "fix" it unless you find it's actually causing a real visible symptom (re-verify before touching this).

## Remaining issues to fix (user-reported this session, verbatim + what to check)

Work through **every one of these** — don't skip any, and don't silently declare something out of scope without saying so explicitly to the user first.

### 1. Stream/server list styling ("the server in the right hand side are looking bad... naming of the server not good looking")
On MetaDetails (and Discover's preview panel), the `StreamsList` component (`src/routes/MetaDetails/StreamsList/`) renders available streams/sources (e.g. "Google Play Movies | Rent" from a redirect-style addon like WatchHub) as plain, unstyled text — visibly inconsistent with the rest of the app's polished dark/ember card system. Also check what "naming" is showing — likely the addon's own raw provider/source name being displayed unformatted rather than a clean, styled label. Restyle this to match the mockup's card system (check if the mockup has an equivalent streams-list treatment; if not, extend the established design tokens/patterns consistently — dark card, ember accents, clear typographic hierarchy for source name vs. quality/price info).

### 2. Card info/preview panel not implemented on Search and Calendar
Discover already has a working side detail panel (poster + title + meta + genres + cast + actions + Show button, wired via `MetaPreview` — see `src/routes/Discover/Discover.js` for the pattern: `selectedMetaItem` state + `<MetaPreview>` render). **Search and Calendar don't have this at all.** Implement the equivalent: clicking/selecting a card in Search results (`src/routes/Search/`) and Calendar's day items (`src/routes/Calendar/`) should show the same kind of detail panel, reusing `MetaPreview` and following Discover's exact wiring pattern (don't reinvent it — copy the approach, adapt to each route's own data shape).

### 3. Sidebar toggle icon
Already partially addressed this session (contrast fix, commit `e0222e9`) — but re-verify against the user's original screenshot complaint once you have it in front of you again; there may be more to it than just contrast (check hover state, click target size, and whether it's easily discoverable).

### 4. Rename WTS → WTSH
Done this session (commit `31d2ee7`) — spot-check `grep -rn "\bWTS\b" src assets manifest.json package.json` (excluding `design/` reference docs and any "Stremio" legal ToS/Privacy text, which correctly stays as "Stremio" since the account backend really is Stremio's) to make sure nothing new has crept back in or was missed.

### 5. Search bar design doesn't match the mockup — DONE this session
Fixed: was a filled, fully-rounded pill; the mockup's `#topSearch` is actually flat/borderless except for a bottom border. Restyled to match (`src/components/NavBar/HorizontalNavBar/SearchBar/styles.less`). Re-verify against a fresh look at the mockup + the user's own screenshot in case there's a more specific detail still off (e.g. exact placeholder copy, icon size at other breakpoints, the `active`/focused state when actually typing).

### 6. Sign-in popup and notification popup rendering behind the hero — z-index issue
**Fixed this session** (commit `9cfe50c`) for the shared `Popup` component used by both the account menu and `NotificationsMenu`. Verify both specifically still look right (screenshot both open, on Board, over the hero) since this was a deep stacking-context fix and either menu could have its own additional wrinkle.

### 7. Active tab indicator/hover behavior "weird, not instant"
Partially addressed (transition speed, commit `1d65da7`). Get more specific clarification from the user if the "weird" behavior persists after that speed change — screenshot/video the actual click-to-click transition and compare to what they expect (instant snap vs. any animation at all).

### 8. Cards sometimes bigger than others
**Fixed this session**, both root causes (CSS Grid in Discover/Library/Search, commit `91db9d5`; flexbox in Board's MetaRow carousels, commit `b71f943`). Re-verify with a fresh, longer catalog (real signed-in session, scroll through several rows) since these were confirmed via direct DOM measurement, not just visual spot-checks — a regression here would be easy to miss visually.

### 9. Addons design "not even close to the article one"
This is the biggest remaining item. Re-read the mockup's Addons page section in `design/ember-rail-mockup.html` in full (tabs — My/Official/Community/Regional/Hub — with pill badges showing counts, the "From the Addon Hub" featured-install section, filter row, addon row layout with icon/name/version/description/actions). Compare component-by-component against `src/routes/Addons/Addons.js` + `styles.less` and its subcomponents (`Addon/`, `RegionalHub/`). Note: `src/routes/Addons/CONSTANTS.js` and `RegionalHub.js` have **unrelated, uncommitted, real WIP from another session** (a large curated list of regional addon manifests) — don't discard or fight that work; it's additive content, separate from the visual restyle needed here.

## Ground rules (carry over from earlier in this project)

- Checkpoint with the user after tackling a meaningful chunk — don't silently disappear for the whole remaining list in one uninterrupted pass on something this large.
- Never invent fake data/backend behavior to make something "look done" (e.g. don't fabricate stream sources or reviews) — if a real data source doesn't exist for something, say so and ask, the way the testimonials-row question was resolved earlier in this project.
- Commit as you go (the user has approved this pattern all session — small, focused commits with clear messages, not one giant commit at the end).
- After each fix, tell the user what's now visible on `localhost:8080` so they can check it themselves in their own browser, not just take your word for it.
