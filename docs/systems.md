# Systems: suggestions, site config, debug, rendering safety

## Game suggestions

Every game's end screen (the `#reveal` state, once a round is over)
shows a "Sigue jugando hoy" `.game-promo` component suggesting other
games. Unlike leaderboard rendering, this one isn't split
data-in-`shared.js`/DOM-in-the-page: `MetroShared.buildGamePromo(currentGameKey,
dateKey)` builds and returns the whole detached `.game-promo` element
(or `null` if there's nothing to suggest) - it only knows the
component's own markup, never the page's, so it never reaches into a
page's DOM itself. Each page's own `renderGamePromo(key)` (duplicated
per page, since mounting into that page's layout is still page-owned
work) just finds its own `#game-promo-slot` placeholder and inserts
(or clears) whatever `buildGamePromo()` returns.

Suggestions are every game in `SUGGESTABLE_GAMES` (`shared.js`) minus
the current game and minus anything already completed **today**, then
**shuffled** and capped to the top `MAX_SUGGESTED_GAMES` (2) so the
section stays a quick glance rather than a full game menu (this
list-building part is also exposed standalone as
`MetroShared.getSuggestedGames(currentGameKey, dateKey)`, which
`buildGamePromo()` calls internally). The shuffle is a seeded
Fisher-Yates (`createSeededRandom('metrordle-suggest-' + dateKey + '-' +
currentGameKey)`), not a fresh `Math.random()` - so the two picks vary
day to day and per game (surfacing every game over time rather than the
old fixed priority order) yet stay stable within a day, so a reload of
the reveal doesn't reshuffle them. `SUGGESTABLE_GAMES`' own array order
no longer matters for which games show, only its membership. "Completed" is
checked via that game's own `'<key>:' + dateKey` localStorage entry
(every game's key matches its `storageKeyFor()` prefix, which is what
makes one shared check possible instead of one per game):
`gameOver`/`status !== 'playing'`/`done` for
Metrordle/Laberinto/Metroguessr, whose saved state can also represent
an in-progress round; any saved entry at all for Memoria/Metro
Crush/Clasificador, which only ever persist a result once a round is
actually over. Always
uses the real calendar day (`new Date()`), never the page's own
possibly-`?debug=true`-simulated `dateKey` - suggestions reflect actual
play activity, not whatever day is being previewed. `buildGamePromo()`
returns `null` (nothing to mount) rather than an empty component if
every other game is already done today.

The `/juegos/` index reuses the same card design through a shared
`buildGameCard(game, muted)` helper (also what `buildGamePromo` builds its
cards from). `MetroShared.buildAllGamesGrid(dateKey)` renders *all* of
`SUGGESTABLE_GAMES` (not minus-current, not capped, not shuffled) sorted
A-Z, with today's already-played games (`isGamePlayedToday`) moved to the
end and muted (`.game-promo__card--played`) but still enabled - see the
`/juegos/` bullet above.

## Site config

`/configurar/` is a site-wide settings page (not a game), reachable
from a small ⚙️ in every other page's header - `.brand__settings` for
every `.brand`-based page, `.topbar__settings` for Metroguessr's own
full-viewport `.topbar` layout instead, since it has no `.brand` row to
attach one to. `/tablero/` and `/purge/` are the only exceptions worth
noting: `/tablero/` still gets the link (harmless, even though it's
itself unlinked from any game's nav); `/purge/` doesn't, since it's
deliberately self-contained with no `shared.css`/`shared.js` at all
(see its own bullet above). `/configurar/` has no gear of its own - a
link from the settings page to itself would be redundant - so
`shared.js`'s `initToolbar` falls back to anchoring the header toolbar
(the light/dark toggle, plus the debug 🐞) inline in its `.brand` row
anyway (the gearless-`.brand` branch), instead of floating it fixed
(`toolbar-tools--fixed`) for lack of an anchor.

All settings live in one `'metrordle:config'` localStorage key holding
a plain object - `MetroShared.loadConfig()`/`saveConfig(partialConfig)`
in `shared.js`, same site-wide-single-key pattern as the alias. Started
with just one field, `mode` (`'light'`/`'dark'`/`'system'`, default
`'system'`); `reducedMotion` (boolean, default `false`, see below) is
the first to actually exercise the "meant to grow more settings later"
design - `saveConfig()` always merges its argument into whatever's
already stored, so setting one key never clobbers another one added
since.

The appearance picker's three-way toggle is `MetroShared.getThemeMode()`
(reads the stored `mode`, defaulting to `'system'` for anything
missing/invalid) and `MetroShared.setThemeMode(mode)` (persists +
applies immediately, no reload - what `/configurar/`'s own buttons
call on each click). Applying a mode just means toggling an attribute:
`MetroShared.applyThemeMode(mode)` sets `data-theme="light"`/`"dark"`
on `<html>`, or removes the attribute entirely for `'system'`.
`shared.css`'s `[data-theme]` rules already existed before this page
did (previously unused, prepared for exactly this) -
`:root[data-theme="dark"]` forces the dark palette regardless of the
OS preference, `:root:not([data-theme="light"])` is what lets
`prefers-color-scheme: dark` keep applying unless light was explicitly
forced instead; `color-scheme` (native scrollbar/form-control chrome)
mirrors the same three states, added alongside this feature since it's
the first thing that actually exercises the override.

Besides `/configurar/`, `shared.js`'s header toolbar renders a two-state
light/dark toggle (☀️/🌑, the icon of the mode it switches TO) next to
the ⚙️ gear on **every** page via the same `setThemeMode()` - a quick
flip without opening settings. It's always visible (the toolbar's `🐞`
debug-log half stays `?debug=true`-only); see shared.js's own
`initToolbar` and `/design/`'s "Formularios"/toolbar notes.

Any page-specific logic that branches on light/dark **must** check
`MetroShared.getThemeMode()` (falling back to
`window.matchMedia('(prefers-color-scheme: dark)').matches` only for
`'system'`), never query `prefers-color-scheme` directly - Metroguessr's
own map tile style (`prefersDark()`, picks between
`MAPLIBRE_STYLES.light`/`.dark`) shipped doing exactly that and, for a
few hours after `/configurar/` itself shipped, could show light chrome
with dark tiles (or vice versa) for anyone with an explicit override
set. `tests/metroguessr/theme.test.js` locks the fix in.

**Every page but `/purge/` needs its own inline `<script>` in `<head>`,
right after its `<link rel="stylesheet" href="/shared.css">`**, that
reads `'metrordle:config'` directly and sets `data-theme` before first
paint - `shared.js` (loaded at the end of `<body>` on every page) runs
far too late to prevent a flash of the wrong theme on a page load, so
this snippet is deliberately self-contained (duplicating the bare
minimum of `loadConfig()`/`applyThemeMode()`'s own logic) rather than
depending on `shared.js` having loaded yet. `shared.js` itself still
calls `applyThemeMode(getThemeMode())` once at load time too - not the
flash-prevention mechanism, just a harmless, idempotent safety net for
a page whose snippet is missing or goes stale. Adding a new game or
utility page later means copying this same snippet into its `<head>`,
same as every other per-page duplication already documented in this
file.

`reducedMotion` is `/configurar/`'s own "Normal"/"Animaciones
limitadas" picker (a two-button group, same shape as the theme picker
minus its third "system" option - there's no "force MORE motion than
the OS wants" use case, so this one is purely additive; a single on/off
toggle button was tried first but read oddly on mobile, not obviously a
two-state control) for a player with motion sickness whose OS/browser
has no `prefers-reduced-motion` setting of its own, or who can't easily
reach it on their device. `MetroShared.getReducedMotion()`/
`setReducedMotion(enabled)`/`applyReducedMotion(enabled)` mirror the
theme mode's own three-function split, but unlike the theme there's no
pre-paint flash to prevent (a frame of default motion behavior isn't
jarring the way a wrong light/dark theme is), so no per-page `<head>`
snippet is needed - `shared.js`'s own `applyReducedMotion(getReducedMotion())`
call at load time is this setting's only real application point, not a
backup for one. **`MetroShared.prefersReducedMotion()` is the one
function every game's own animation timing already calls** (each
page's own `delay()` helper, computed once at load from this; or a live
check, like Metro Crush's `collapseBoard()`) - it now ORs the OS media
query with this setting, so turning the setting on reduces motion
everywhere those call sites already check, with no further per-game
wiring needed. `applyReducedMotion()` itself just toggles
`data-reduced-motion="true"` on `<html>` (or removes it) for the one
thing a JS-level check can't catch: a raw CSS `transition`/`@keyframes`
animation with no JS gate of its own - `shared.css` has a
`:root[data-reduced-motion="true"] *` rule that's an exact twin of its
own `@media (prefers-reduced-motion: reduce)` block, rather than a
combined selector, so the two stay simple and independently readable.

`/configurar/`'s third section, Alias, is the one place to change
`metrordle:alias` directly (every other place it's ever set is a
per-game leaderboard's own first-time alias-input row, see
"Leaderboards" above) - a `.leaderboard__alias` input+button row
(shared.css, the exact markup every game's own leaderboard alias row
already uses) pre-filled from `MetroShared.getAlias()`, saved via the
same `MetroShared.setAlias()` every other call site uses. A blank/
whitespace-only submission is rejected with an error notice rather
than silently clearing the alias (every other call site's own
`save()` just `return`s on an empty `setAlias()` result, with no
feedback either way - fine for a quick inline leaderboard row, not for
a dedicated settings field someone could accidentally submit blank).
The success/error notice (`#alias-notice`, `aria-live="polite"` same
as Metro Crush's own `.toast`) auto-hides after 4s. Detecting a
genuine save failure (private mode, full storage) needs an extra step
since `setAlias()` itself always returns the normalized value
regardless of whether the write actually landed - the only way to
tell is reading `getAlias()` back immediately after and comparing.
See the Leaderboards section's own intro above for what changing the
alias here does and doesn't do to already-submitted entries.

## Rendering safety

**Every leaderboard `alias` render uses `.textContent`, never
`.innerHTML`** - aliases are arbitrary user text (Firestore only
validates type/length, not content) and are the only content that
flows from one player into another's browser. This convention is not
enforced by tooling (no lint/build step) - grep for `entry.alias` and
confirm every hit is a `.textContent` assignment before adding any new
leaderboard consumer. A CSP `<meta>` tag on every page adds
defense-in-depth on top of this (see each page's own CSP comment for
the exact policy and its documented `'unsafe-inline'` tradeoff).

## Debug mode

`?debug=true` on any game page reveals a prev/next date-nav
(`MetroShared.getEffectiveToday`/`getDateKey`) to preview any day's
puzzle without waiting for it, and makes `submitScore()` a no-op site-wide
so date-nav testing never pollutes the real leaderboards. `?date=YYYY-MM-DD`
also works standalone (validated by regex, falls back to real "today" if
malformed).

## PWA install & data transfer

All personal progress lives in localStorage (alias `metrordle:alias`,
config `metrordle:config`, per-game streaks `<game>:streak`, per-day game
states, notice flags). When the site is installed as a PWA, **iOS gives
the standalone app a storage sandbox separate from Safari**, so streaks
look wiped after "Agregar a inicio" (Android usually shares storage, but
the feature still helps move between devices). Leaderboard scores (keyed by
`aliasDocId`) and global records (`records/{gameKey}`) already live in
Firestore, so restoring the **alias** reassociates them - only the
localStorage-only data has to travel.

The transfer API lives in `shared.js`:
- `exportLocalData()` - snapshots the app-owned localStorage keys (minus
  the dev-only `metrordle:leaderboard-fallback:*`). Undated keys (streaks,
  alias, config, flags) are kept in full; dated daily-state keys
  (`<game>:YYYY-MM-DD`) are pruned to the last `TRANSFER_DAILY_KEEP_DAYS`
  (7), since they accumulate one-per-day forever (the streak they fed is
  preserved separately). As a hard guarantee, the serialized snapshot is
  then capped under `TRANSFER_MAX_DATA_CHARS` (dropping daily states
  oldest-first) so a heavy player's write can never exceed the
  `transfers/{id}` size cap - no rules change needed.
- `createTransfer()` - writes the snapshot (as a JSON string) to a new
  `transfers/{id}` doc (`id` = random base62, the user-facing code) and
  resolves the id. See `docs/firebase.md` for the collection + rules.
- `restoreTransfer(id)` - fetches the doc and **merges** into localStorage,
  never regressing: streaks keep the higher `count`/`max` (via
  `loadStreak`/`saveStreak`), config lets local choices win, the alias is
  adopted only if none is set, and every other key is filled only when
  absent. Rejects expired (`createdAt` > ~7 days) / missing / corrupt docs.
- `isStandalonePWA()` / `getDeferredInstallPrompt()` - detect the installed
  app and hold Android's `beforeinstallprompt` for `/configurar`'s button.

UI: **`/configurar`** (which now loads the Firebase SDK, with the same
Firebase-allowing CSP as the game pages) hosts the full flow - an install
button, "generate code" (shows the code + a `?restore=<id>` link + copy
buttons), and a "restore with a code" field. On top of that, `shared.js`
runs `initDataTransferBanner()` on every page: a `?restore=<id>` link
(tapped inside the app) auto-restores and reloads via a bottom
`.transfer-banner`; a just-installed standalone app with empty storage gets
a gentle nudge toward `/configurar` (the nudge isn't gated on
`firebaseReady()`, since the PWA start page `/juegos/` doesn't load the
Firebase SDK and the nudge only links to `/configurar`, which does). The
manifest `start_url` is static, so a per-user id can't ride into the
installed app automatically - the typed code is the reliable path, the link
is the convenience path.
