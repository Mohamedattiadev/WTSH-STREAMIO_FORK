# Make the real app's CSS/HTML 100% match the Ember Rail mockup — no leftover Stremio styling

## Why this prompt exists

A previous attempt at this port left the app still looking like stock Stremio in places. The two most likely causes, both addressed explicitly below:

1. **Reading the wrong part of the mockup file.** `design/ember-rail-mockup.html` is a *Claude Artifact* — it has an outer "viewer page" wrapper around the actual app mockup (intro text, a note panel, a fake browser-frame with dots and resize handle, preset buttons). **None of that outer wrapper is the app.** The real design is everything inside `.frame` → `.app`. If you copied colors/spacing from `.page`, `.intro`, `.note`, `.frame-topline`, or `.viewport-presets`, that's the bug — those don't exist in the real product at all.
2. **The old Stremio palette is imported in ~58 `.less` files**, not just the nav. Redoing `VerticalNavBar`/`HorizontalNavBar` alone leaves every button, card, modal, and toggle elsewhere still pulling from `@stremio/stremio-colors` (a purple/teal palette — `@color-primary-light5` is `hsla(275°, 33%, 63%)`, nowhere near this design's ember/near-black). This prompt tells you how to find and eliminate every one of those, not just the nav's.

Work through this section by section. Don't skip the verification grep commands at the end — that's how you *prove* nothing old is left, instead of eyeballing it.

## Step 0 — Confirm what's real vs. viewer chrome

Open `design/ember-rail-mockup.html` and locate these two regions:

- **IGNORE**: `:root{ --bg:#F6F4EF; --fg:#17181D; --muted:#6B6F7A; --accent:#E85A2C; ... }` and everything under `.page`, `.intro`, `.eyebrow`, `h1`, `.frame-topline`, `.viewport-presets`, `.preset-btn`, `.note`. This is the Claude Artifact's own page chrome (a light cream background, explanatory text, a fake "desktop preview" title bar with traffic-light dots, Desktop/iPad/Phone buttons). It has zero equivalent in the real app.
- **THIS IS THE APP**: everything from `.frame{ --ink:#0C0A0C; ... }` downward, plus `.app`, `.rail`, `.topbar`, `.content`, every `.page-view[data-page="..."]` block, and the `<script>` at the bottom. This *is* the actual shell and pages you're porting.

If in doubt about whether a class belongs to real UI or viewer chrome: search for it inside `.app { ... }`'s subtree in the HTML. If it's not nested inside `<div class="app">`, it's not part of the product.

## Step 1 — The exact token set (copy these values verbatim)

These are the CSS custom properties defined on `.frame` in the mockup — this is the complete palette, nothing else:

```
--ink:        #0C0A0C   (page/app background — near-black, warm undertone, NOT cool blue-black)
--panel:      #141013   (rail background base, phone-frame equivalents)
--panel-2:    #1D1417   (elevated surfaces: topline bars, popups, modals, dropdowns)
--ember:      #FF5F36   (primary accent — buttons, active states, focus rings)
--ember-2:    #FF3D2E   (accent gradient partner — used with --ember in linear-gradients)
--ember-soft: #FFB088   (tinted accent for text-on-dark, badges, hover states)
--paper:      #F5F2EC   (primary text color — warm off-white, NOT pure #FFFFFF)
--mist:       #77747E   (secondary/muted text, icons, placeholders)
--line:       rgba(255,255,255,0.055)   (hairline borders everywhere — very faint)
```

Fonts (Google Fonts, already linked in the mockup's `<link>` tag):
- **Unbounded** (weights 400/600/800) — display/heading font: nav wordmark, page `<h2>`/`<h3>` titles, card titles in modals.
- **Manrope** (weights 400/500/600/700/800) — body font, the default for everything else.
- **IBM Plex Mono** (weights 400/500) — used *only* for: badges (4K HDR, ratings, addon versions), timestamps, mono-style labels (search result source tags, notification times).

Two things to get right that are easy to get subtly wrong:
- `--ink` is `#0C0A0C` — warm near-black with a very slight red/brown undertone, not a cool blue-black like `#0A0A12` or similar. This matters because it's what makes the ember accent pop instead of looking muddy.
- `--paper` (`#F5F2EC`) is warm off-white, not `#FFFFFF`. Every place text uses "white" in this design, it's actually this token.

## Step 2 — Root-level integration point

Before touching individual components, find where *this app already defines* its own CSS custom properties (grep for `--primary-foreground-color`, `--surface-elevated-color`, `--overlay-color`, `--border-radius`, `--card-hover-shadow`, `--vertical-nav-bar-size`, `--horizontal-nav-bar-size` — these already exist and are consumed by many components). Redefine *those* existing tokens' values to the new palette above wherever it's a legitimate 1:1 mapping (e.g. `--surface-elevated-color` → `var(--panel-2)`-equivalent value, `--primary-foreground-color` → the paper/mist values depending on context, `--border-radius` → check the mockup's actual radius scale below). This gets you free reskinning in every component that already reads from these tokens, without touching each file.

Then handle the LESS-variable layer separately (next step) — CSS custom properties and Less `@variables` are two different mechanisms in this codebase and neither one overrides the other automatically.

## Step 3 — Eliminate the old Stremio Less palette everywhere, not just the nav

Run this first, to see the actual scope:

```
grep -rl "stremio-colors" src --include="*.less" | wc -l
grep -rl "stremio-colors" src --include="*.less"
```

(As of this design pass that's **58 files**.) Every one of those imports `@stremio/stremio-colors/less/stremio-colors.less` and very likely uses `@color-accent1*`, `@color-primary*`, `@color-secondaryvariant*` etc. somewhere in the file. Those resolve to a purple/teal HSL palette completely unrelated to ember — this is very likely the actual source of "still looks like Stremio" even after the nav was redone.

Two ways to fix this, pick based on how much time you have — **the second is much faster if it works cleanly**:

**Option A — per-file replacement.** For each of the 58 files, open it, find every `@color-*` variable in use, and replace it with the correct new token (usually `--ink`/`--panel`/`--panel-2`/`--paper`/`--mist`/`--line`/`--ember` depending on what role that color was playing — background vs. text vs. border vs. accent). This is the safe, thorough option and lets you catch component-specific issues as you go. Do this in batches of ~8-10 files with a visual check after each batch, not all 58 blind.

**Option B — override shim.** Create `src/common/stremio-colors-override.less` that redefines the same Less variable names (`@color-accent1`, `@color-primary-light5`, etc. — check `node_modules/@stremio/stremio-colors/less/stremio-colors.less` for the full variable list) to ember-equivalent values, and have each of the 58 files import your override *immediately after* their existing `@import (reference) '~@stremio/stremio-colors/less/stremio-colors.less';` line (Less resolves same-name variable redefinition by whichever was declared last in the compiled output, so order matters). This is much faster to apply everywhere at once, but verify carefully — some of those 58 files may use the palette for something *not* visual (rare, but check), and a global override could have side effects a per-file fix wouldn't.

Whichever you pick, don't stop at "the app looks right at a glance" — actually re-run the grep after your changes and confirm the files either no longer reference the raw Stremio hex/hsla values in their compiled output, or that every reference is now going through your override.

## Step 4 — Component-by-component exact specs

Transcribed directly from the mockup's `<style>` block. Use these numbers, don't approximate them.

### Rail (replaces `VerticalNavBar`)
- Width collapsed: `4.75rem`. Width expanded: `14rem`. Transition: `width 0.28s cubic-bezier(.4,0,.2,1)`.
- Background: `linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 40%)` over `--ink`. Right border: `1px solid var(--line)`.
- Logo mark: `2.75rem × 2.75rem`, a plain gradient play-triangle icon (`linear-gradient(145deg, var(--ember), var(--ember-2))` used as the *icon fill*, not a background — **no circular badge behind it**, just the icon shape itself with `filter: drop-shadow(0 4px 10px rgba(255,61,46,0.5))`).
- Nav items: `2.75rem × 2.75rem` square, centered, `border-radius: 0.75rem`, icon `1.3rem`. **Critical bug to avoid**: `gap` between icon and label must be `0` when collapsed and `0.75rem` only when `.rail.expanded` — if you set a nonzero gap unconditionally, the (hidden) label text still reserves layout space and pushes icons off-center. Label itself: `opacity:0; max-width:0; overflow:hidden` when collapsed (not just `opacity:0` alone — same reason).
- Active indicator: a `0.22rem`-wide vertical bar, `2.75rem` tall, flush to the rail's left edge (`left:0`), gradient `linear-gradient(180deg, var(--ember), var(--ember-2))`, glow `box-shadow:0 0 12px rgba(255,95,54,0.6)`, animated via `transform: translateY(...)` matching the active item's `offsetTop` (not `nth-child` math — compute from the actual DOM position so it can't drift out of sync).
- Collapse/expand toggle: a small circular handle (`1.6rem`), positioned absolutely at the rail's vertical center, on its right edge (`right:-0.8rem`) — not a button buried at the bottom.
- Every rail item shows a tooltip (its label) on hover *only while collapsed*, positioned to the right of the icon.

### Top bar (replaces `HorizontalNavBar`)
- Height `4.5rem`, flush full-width, no floating card/margin around it. `border-bottom:1px solid var(--line)`.
- Search field: **flat by default** — no background box, no border box, just a `border-bottom:1px solid var(--line)` and a search icon + placeholder text. On hover, border tints ember. This is deliberate: the search/HDR-badge/fullscreen-button trio should read as one continuous strip, not three separate pill-shaped chips floating in a row.
- Icon buttons (fullscreen, notification bell): `2.75rem × 2.75rem`, `border-radius:0.7rem`, transparent by default, `background:rgba(255,95,54,0.1)` + `color:var(--ember-soft)` on hover only.
- Avatar: `2.75rem`, fully circular, `linear-gradient(135deg, var(--ember), var(--ember-2))` fill, initials in `Unbounded` 800.
- Notification bell badge: a small numbered pill (not a bare dot) — `min-width:1rem; height:1rem; border-radius:1rem`, ember background, dark text, positioned top-right of the bell icon.

### Buttons — the specific bug to not reintroduce
Every button in this design (`.btn-play`, `.btn-ghost`, `.btn-sm`, action icon buttons) must have `white-space: nowrap` and sit inside a parent row with `flex-wrap: wrap`. The mockup's own earlier draft broke this (icon+text wrapped onto two lines inside narrow cards, and overflow got silently clipped by an `overflow:hidden` ancestor) before it was fixed — don't reintroduce it by copying an incomplete version of a button style. A button's *content* never wraps; if a *row* of buttons doesn't fit, the whole button drops to a new line, never its internal text.

### Cards / posters
- Aspect ratio: `2 / 3` (not a fixed pixel height) — this is what makes posters scale correctly across the responsive grid instead of going wide-and-flat at some breakpoints.
- Border: `1px solid var(--line)`, `border-radius: 0.8rem`.
- Hover: `transform: translateY(-4px)` + ember-tinted glow shadow + border tints ember.
- Trailer affordance: a labeled pill (`▶ Trailer`, not a bare icon) centered on the poster, revealed on hover, `background: rgba(10,9,10,0.72)` with a subtle border — not a full-opacity solid button.
- A separate small circular "remove" button (only on Library/in-progress cards) sits top-right, independent of the trailer pill.
- Every card shows a small info line under the title: a star rating always; for in-progress items, also a watch count and resume percentage.

### Cards' progress bar
`0.2rem` tall, `border-radius:0.2rem`, track `rgba(255,255,255,0.2)`, fill `var(--ember)` solid.

### Tags / chips / badges
- `.tag`: pill, `height:1.6rem`, `border:1px solid var(--line)`, muted text, no fill.
- `.chip` (sort/filter pills): `height:2.3rem`, `border-radius:2rem`; active state gets an ember border + `rgba(255,95,54,0.1)` fill + paper text.
- Rating badges: small icon (star path) + `IBM Plex Mono` number, `color:#FFD166` (a distinct gold, not the ember accent — ratings use a different hue than the brand accent, intentionally).

### Modals (trailer modal is the reference pattern)
- Backdrop: `rgba(6,5,6,0.72)` + `backdrop-filter: blur(3px)` over the whole viewport area.
- Panel: `var(--panel-2)` background, `border:1px solid var(--line)`, `border-radius:1rem`, large soft drop shadow (`0 30px 60px -16px rgba(0,0,0,0.6)`).
- A video-thumbnail-style header region (poster-tinted gradient background, centered play control in a translucent ring, a small duration badge bottom-left) sits above a body region with title (`Unbounded`), tag row, synopsis paragraph, and an action row (which — see the button rule above — must `flex-wrap`).

### Border-radius scale (use consistently, don't invent new values)
`0.4–0.5rem` small chips/icon-buttons · `0.7–0.75rem` standard buttons/rail-items · `0.8–1rem` cards/panels · `1.1–1.4rem` large surfaces (modals, hero banners, the outer frame).

## Step 5 — Responsive tiers (do this with real container queries, not guesses)

The mockup uses **CSS container queries** (`container-type: inline-size` on the shell + `@container shell (max-width: Npx)`), specifically so the layout responds to the *app shell's* width, not the raw browser viewport — this matters if the app shell is ever embedded, resized, or shown in a panel narrower than the full window. Check whether this codebase's existing `screen-sizes.less` breakpoints are viewport-media-query-based; if so, decide deliberately whether to introduce container queries here or reconcile with the existing pattern, and say which you chose and why — don't silently pick one.

- **≥1180px (desktop/iPad)**: rail as a left sidebar, grids + side preview panels sit side-by-side.
- **720–1180px (tablet)**: stays side-by-side (grid + panel), just tighter — panels shrink, grid columns reduce. Do **not** stack these — an earlier draft over-stacked at this tier and it was called out as wrong; side-by-side must survive down to ~720px.
- **<720px (phone)**: rail becomes a bottom tab bar (icon + label, equal-width tabs via `flex:1 1 0`, not content-sized — content-sized tabs of different label lengths produce a visibly uneven bottom bar), hover-only preview panels hide entirely (there's no hover on touch), grids drop to 2 columns, top bar goes icon-only.

## Step 6 — Verify, don't eyeball

Run these after you think you're done:

```
# No raw Stremio Less color variables should still resolve to the old palette
grep -rn "@color-primary\|@color-accent1\|@color-secondaryvariant" src --include="*.less" | grep -v "your-override-file"

# No hardcoded old Stremio hex/hsl remnants sitting outside the token layer
grep -rn "hsla(275" src --include="*.less"

# Confirm the new tokens are actually the ones in effect
grep -rln "FF5F36\|FF3D2E\|0C0A0C" src --include="*.less" | wc -l
```

Then do a side-by-side: open the real app and `design/ember-rail-mockup.html` in two browser tabs at the same width, and go route by route comparing rail, top bar, and each page. Anywhere they visibly diverge in color, spacing, or radius is a miss — fix it before moving to the next route, not after doing all of them.
