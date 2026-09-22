# AGENTS.md

Context for picking up work on this repo in a new session. Read this
first; it links out to the deeper docs (`tests/README.md`,
`firestore.rules`) rather than duplicating them.

## What this is

**Metrordle** (metrordle.com): a family of daily Wordle-style minigames
themed around the Mexico City Metro. Static site, **no build step** -
every page is a single self-contained `.html` file with inline
`<style>`/`<script>`, deployed as-is via GitHub Pages (see `CNAME`).
Site copy/UI is in Spanish (`es-MX`).

## The games

- **`/` (`index.html`)** - Metrordle: order 5 stations of one Metro line
  correctly in 5 attempts. Has a "normal"/"hard" mode toggle
  (`state.mode`), chosen via a modal on a fresh day.
- **`/laberinto/`** - Metrordle: Laberinto: navigate from an origin to a
  destination station, picking neighbors/lines at each hop.
- **`/memoria/`** - Metrordle: Memoria: a 60-second memory-match game
  pairing station icons with names.
- **`/metroguessr/`** - Metrordle: Metroguessr: guess the Metro station
  marked on a Leaflet map (CARTO tiles) in 5 attempts, hinted by
  distance + compass direction after each guess. Has a "normal"/"hard"
  mode toggle (`state.mode`), chosen via a modal on a fresh day, same
  pattern as Metrordle's own - hard mode locks the map (no pan/zoom)
  while playing, same as this game always worked before the split;
  normal mode leaves it free throughout. Either way the map unlocks and
  swaps in the target's real station-icon badge (Metro Crush's
  pictogram style, colored by line) once the round ends. Once the first
  guess is in, a hint button (`🪄`, same `.guess-btn` styling as
  "Adivinar") unlocks - up to two sequential hints, each burning one
  of the round's 5 attempts like a wrong guess would: the first
  recolors the live marker to the target's real line color AND pins a
  small badge marker (`hintLineMarker`, `.hint-line-badge`) right on
  top of it naming the line's own short id ('4', 'A', '12', ...) -
  color alone isn't accessible, so the number carries the same
  information as text; the second reveals street/place labels early
  (`setLabelsVisible(true)`, otherwise only shown once the round ends).
  `applyHintEffects()` is fully idempotent (always resets the
  marker/badge to baseline before reapplying for the current
  `state.hintsUsed`), which is what makes it safe to reuse as-is across
  a debug date-nav jump between two different days, not just a live
  `useHint()` call or a same-day reload restore. Hints are tracked as
  `state.hintsUsed` (0-2), kept separate from `state.guesses` since a
  hint has no station name/distance of its own and must not show up as
  a fake guess in the history chips or map pins - `state.attempts` is
  `guesses.length + hintsUsed`, and that's what's submitted to the
  leaderboard (not `guesses.length` alone), so a hint-assisted win
  still ranks behind an unassisted one at the same guess count.
  `hintsUsed` is also submitted as its own leaderboard field, purely
  for display - not part of `orderBySpecs` - rendered as one 🪄 per
  hint used, before the existing 🧠 hard-mode flag, in the same
  `.leaderboard__score-badge` slot (widened past shared.css's default
  in this page's own CSS, with `white-space: nowrap` and
  `text-align: right` added, since it can hold up to three emoji on
  one line here and should still sit close to the score number when it
  only holds one or two - `.leaderboard__score`'s own page-local `gap`
  is what keeps a breathing space between the two once the badge itself
  is right-aligned, rather than the badge butting straight up against
  the number). The score itself is a bare digit with no "intento(s)"
  suffix (dropped since the rank/badge/number layout already makes it
  obvious what it counts) in a fixed single-digit-width column, same
  convention as Metrordle's and `/admin/`'s own leaderboards - together
  with the badge's own fixed width, this lines every row up into a
  table-like grid regardless of how many emoji a given row's badge
  holds.
  Has its own leaderboard (see below) and core-mechanics + leaderboard
  Playwright coverage under `tests/metroguessr/`.
- **`/metrocrush/`** - Metrordle: Metro Crush: swap two adjacent stations
  to form rows of 3+ of the same line before a 60-second timer runs out,
  Bejeweled-style, with a normal/hard mode toggle (hard hides each
  tile's line color, revealing it only mid-pop) and cascading combos.
  Has its own leaderboard (see below), but like Metroguessr above,
  **no committed Playwright tests yet** - only ad-hoc scratchpad
  scripts so far, not `tests/`. Not linked from any other game's nav
  yet.
- **`/admin/`** - read-only cross-game leaderboard browser (not linked
  from any game's nav, `noindex`). Same prev/next date-nav as the
  games' own `?debug=true` mode, but always on.
- **`/configurar/`** - site-wide settings page, linked from every game's
  header (a small ⚙️ in `.brand`, or `.topbar` for Metroguessr's own
  layout) via `.brand__settings`/`.topbar__settings`. For now just a
  Claro/Oscuro/Sistema appearance picker - see "Site config" below for
  the storage/theming mechanism, meant to grow more settings later
  without a new page or a new localStorage key.
- **`/purge/`** - a recovery page that clears Cache Storage + unregisters
  the service worker, then redirects home. Deliberately self-contained
  (no `/shared.js`/`/shared.css` dependency), since it exists to recover
  from a *broken* cache.

Each game is deterministic per calendar day: a seeded RNG
(`MetroShared.createSeededRandom('<salt>-' + dateKey)`) derives that
day's puzzle from the date, so everyone gets the same puzzle and replays
are impossible without a debug override.

## Shared infrastructure

- **`shared.js`** - `window.MetroShared`: date-key/seeded-RNG helpers,
  streak tracking (localStorage, also submitted to each game's own
  leaderboard for `/admin/`'s 🔥 display - see "Streaks" below), alias
  helpers, the leaderboard API (`submitLeaderboardScore`/
  `getTopLeaderboardScores`, collection- and field-shape-agnostic - see
  "Leaderboards" below), clipboard/share
  helpers (`shareOrCopyText`, native `navigator.share` with a
  clipboard-copy fallback), `buildGamePromo(currentGameKey,
  dateKey)` for the "sigue jugando hoy" component on every game's own
  end screen (see "Game suggestions" below), and the site-wide config
  object (`loadConfig`/`saveConfig`/`getThemeMode`/`applyThemeMode`/
  `setThemeMode` - see "Site config" below).
- **`shared.css`** - design tokens (`:root` custom properties, light +
  dark via `prefers-color-scheme` and `[data-theme]`), the embedded
  Overpass font (base64 `@font-face`, huge single line - don't `cat`
  the whole file), and cross-game primitives (`.wrap`, `.brand`,
  `.sign`, `.date-debug`/`.chev` date-nav, `.debug-mode-toggle`,
  `.mode-modal`/`.mode-option*` pre-game normal/hard choice,
  `.btn-primary`/`.btn-secondary`, `.leaderboard*` including the
  `.leaderboard__score-badge` hard-mode 🧠 flag). Game-specific CSS
  (including a game's own leaderboard sizing deltas, if any) lives in
  that page's own `<style>` block - **put any styling shared by 2+
  pages in `shared.css`, not copy-pasted per page** (this has already
  happened more than once - check for an existing shared rule before
  adding a new page's version of something another game already has).
- **`firebase-config.js`** - **contains the real, live Firebase
  project's credentials on `main`.** See "Firebase credential safety"
  below before ever running tests locally.
- **`firestore.rules`** - hand-maintained, still no CI deploy pipeline -
  either paste it into the Firebase console manually, or (`firebase.json`/
  `.firebaserc` point at the real `metrordle-23704` project already)
  run `firebase deploy --only firestore:rules` locally after `firebase
  login` under your own account. Either way this is a manual, deliberate
  step - nothing in CI runs it automatically, and it's on you to remember
  to actually deploy after a PR that changes this file merges. One
  `match` block per leaderboard collection, validating shape/type/bounds
  only (no login system exists, so these can't verify a human played
  fair - accepted tradeoff for a casual leaderboard).
- **`sw.js`** - service worker. Navigations: network race with a
  1.5s timeout, falling back to cache, updating the cache in the
  background regardless of who won the race. Static assets: cache-first.
  Per-client freshness tracking keeps a tab's own page and its
  `shared.js`/`shared.css` from diverging in version. **Bump
  `CACHE_NAME` on any change to `sw.js` or any precached asset** -
  check open PRs first for numbering collisions (any two PRs touching
  that line collide on merge regardless of the number picked).
  **Every player-facing game route belongs in `PRECACHE_URLS`, both as
  the directory (`/metroguessr/`) and its `index.html`** - Metroguessr
  shipped without either for several PRs before this was caught; when
  adding a new game, add both paths here (and bump `CACHE_NAME`) in the
  same PR that ships it. `/admin/` and `/purge/` are deliberately
  excluded (not linked from any game's nav, and "must never itself be
  cached," respectively) - don't add those.

## Leaderboards

Each game has its own daily Firestore leaderboard:
`{collection}/{dateKey}/entries/{aliasDocId}`, collections
`metrordle-leaderboard` / `laberinto-leaderboard` / `memoria-leaderboard` /
`metroguessr-leaderboard` / `metrocrush-leaderboard`.
Alias is a free-text nickname (site-wide `metrordle:alias` localStorage
key, shared across all games) with **no rename** - the alias *is* the
document ID (lowercased), so changing it would orphan the old entry;
two players choosing the same alias silently share/overwrite one entry
(known, accepted limitation).

Per-game conventions, each with its own ranking rule baked into
`orderBySpecs` (an ordered `[field, 'asc'|'desc']` list; `submittedAt`
asc is always the final tiebreak). **Only `orderBySpecs[0]` is ever
passed to Firestore's own `.orderBy()`** - `getTopLeaderboardScores()`
fetches ordered (and capped) by that one field alone, then applies the
*whole* `orderBySpecs` list (plus the `submittedAt` tiebreak) itself
client-side via `compareByOrderSpecs()`. This is deliberate, not an
optimization to undo: Firestore's `.orderBy(field)` silently **excludes**
any document missing that field from the query's results entirely (no
error, just fewer rows) - ordering server-side by every field in
`orderBySpecs` would silently drop any entry submitted before a later
field existed on that collection. This isn't hypothetical - it's
exactly what broke `/admin/`'s Metroguessr leaderboard the day
`hardMode` was added to its `orderBySpecs`: every entry from earlier
that same day (before that field existed on writes) vanished from
every query ordering by it, with nothing visibly erroring anywhere.
**Adding a new field to an existing collection's `orderBySpecs`
requires no code changes to stay safe** (the split above already
handles it, and `compareByOrderSpecs()` treats a missing field as
`false`/`0` rather than crashing) - just be aware that any entry
submitted before that PR won't have the new field, and will rank
accordingly (lowest) until/unless it's backfilled. `orderBySpecs[0]`
itself doesn't have this risk, since it's each collection's original
ranking field, present since the collection was created.

A field that's purely informational - rendered somewhere, never
sorted/tie-broken on (Metroguessr's own `hintsUsed`/🪄 badge, every
game's `streak`/🔥 one, see below) - should almost never go in
`orderBySpecs` at all, exactly to sidestep the exclusion risk above.
But `getTopLeaderboardScores()` only ever copies `orderBySpecs` fields
(plus `id`/`alias`/`submittedAt`) from the Firestore document into the
entry object it hands back - **a field left out of `orderBySpecs` still
needs to be named in `options.extraFields` (an array of field names) to
reach the caller at all**, or it reads `undefined` even on an entry
that has it. This bit Metroguessr's own `hintsUsed` field for a full
PR: it was submitted correctly and rendered via `entry.hintsUsed` in
that page's own `renderLeaderboard()`, but nothing ever asked
`getTopLeaderboardScores()` to actually copy it over, so every real,
Firestore-backed entry's 🪄 badge silently stayed empty in production
the whole time - caught only once `streak` needed the exact same
plumbing and a test (`tests/shared/leaderboard-query.test.js`) was
added to lock the fix in.
- Metrordle: fewest attempts, hard-mode beats normal-mode at a tie
  (`[['attempts','asc'],['hardMode','desc']]` - relies on Firestore/the
  JS comparator ordering `false < true`).
- Laberinto: fewest stations, then fewest transfers, both ascending.
- Memoria: highest score, descending.
- Metroguessr: fewest attempts, hard-mode beats normal-mode at a tie -
  same shape as Metrordle's own combined ranking
  (`[['attempts','asc'],['hardMode','desc']]`). Like Metrordle/Laberinto,
  not Memoria: a loss has no meaningful "attempts to solve," so (see
  below) it only submits on a win.
- Metro Crush: highest score, descending - same shape as Memoria's, but
  a cumulative round total rather than a fixed-size puzzle's score, so
  its Firestore rule bounds `score` generously (20000) instead of
  tightly (see `firestore.rules`).

Submission pattern (identical across all 5 games): a
`leaderboardSubmitted` flag persisted alongside the game result, so a
reload never resubmits; `submitScore()` no-ops without an alias, under
`?debug=true`, or (Metrordle/Laberinto/Metroguessr only) on a loss/give-up
- only a genuine win has a meaningful score to rank. On those same three
games, `renderAliasRow()` hides the whole `#leaderboard-alias-row` on a
loss/give-up too (rather than a no-alias player seeing an entry form
that would silently do nothing if filled in) - Memoria/Metro Crush
always have a meaningful score, so their alias row always shows.
`renderLeaderboard()` never clears the DOM before its fetch resolves
(avoids a flicker on reload), guarded by a monotonically increasing
request-id so a stale response can't paint over a newer one.

### Streaks

Metrordle, Laberinto, Memoria, and Metroguessr all track a consecutive
-days streak (`MetroShared.loadStreak`/`saveStreak`/
`updateStreakForResult`/`formatStreak`/`formatMaxStreak` in
`shared.js`, one `'<key>:streak'` localStorage entry per game,
separate from that day's own `'<key>:' + dateKey` round-result entry) -
a win extends it, a loss/give-up resets it to 0, and it's shown on that
game's own reveal banner/share text (`🔥 Racha: N días`, plus a
"máxima: M días" mention only when the best-ever streak is still ahead
of today's). Metro Crush has no streak concept - its games are scored
per-round, not "won" day to day, so there's no well-defined "extended
it or not" for a streak to track.

Each of those four games' own `submitScore()` also submits `streak` as
a leaderboard field now, purely for display - like `hintsUsed` above,
it's deliberately never part of `orderBySpecs`, so a query's
ranking/results are identical whether or not a given entry (old or
new) happens to have it. `/admin/`'s own `streakCell()` renders it the
same way for all four collections: **`🔥 x N` when `N > 1`, nothing
otherwise** (a streak of 0 or 1 isn't yet "a streak" worth calling
out) - each of those four `GAMES` entries needs `extraFields: ['streak']`
for the value to actually reach that cell at all (see `extraFields`
above). Metro Crush's own `GAMES` entry has neither the field nor the
cell showing anything for it, since its entries never carry `streak`
in the first place.

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

Suggestions follow a fixed priority order - Metrordle, Memoria,
Metroguessr, Laberinto, Metro Crush (see `SUGGESTABLE_GAMES` in
`shared.js`) - minus the current game and minus anything already
completed **today**, capped to the top `MAX_SUGGESTED_GAMES` (2) so the
section stays a quick glance rather than a full game menu (this list-building
part is also exposed standalone as `MetroShared.getSuggestedGames(currentGameKey,
dateKey)`, which `buildGamePromo()` calls internally). "Completed" is
checked via that game's own `'<key>:' + dateKey` localStorage entry
(every game's key matches its `storageKeyFor()` prefix, which is what
makes one shared check possible instead of one per game):
`gameOver`/`status !== 'playing'`/`done` for
Metrordle/Laberinto/Metroguessr, whose saved state can also represent
an in-progress round; any saved entry at all for Memoria/Metro Crush,
which only ever persist a result once a round is actually over. Always
uses the real calendar day (`new Date()`), never the page's own
possibly-`?debug=true`-simulated `dateKey` - suggestions reflect actual
play activity, not whatever day is being previewed. `buildGamePromo()`
returns `null` (nothing to mount) rather than an empty component if
every other game is already done today.

## Site config

`/configurar/` is a site-wide settings page (not a game), reachable
from a small ⚙️ in every other page's header - `.brand__settings` for
every `.brand`-based page, `.topbar__settings` for Metroguessr's own
full-viewport `.topbar` layout instead, since it has no `.brand` row to
attach one to. `/admin/` and `/purge/` are the only exceptions worth
noting: `/admin/` still gets the link (harmless, even though it's
itself unlinked from any game's nav); `/purge/` doesn't, since it's
deliberately self-contained with no `shared.css`/`shared.js` at all
(see its own bullet above).

All settings live in one `'metrordle:config'` localStorage key holding
a plain object - `MetroShared.loadConfig()`/`saveConfig(partialConfig)`
in `shared.js`, same site-wide-single-key pattern as the alias. This
starts with just one field, `mode` (`'light'`/`'dark'`/`'system'`,
default `'system'`), but the object is meant to grow more settings
later without a new page, a new key, or a migration -
`saveConfig()` always merges its argument into whatever's already
stored, so setting one key never clobbers another one added since.

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

## Tests

Playwright, no framework beyond `assert` - see `tests/README.md` for
the full breakdown of what each file covers and how to add a check.
`cd tests && npm test` runs everything (~95s).

**Before running tests locally, swap `firebase-config.js`'s real
credentials for fake placeholder ones, then restore and verify
`git diff origin/main -- firebase-config.js` is empty before
committing/pushing - never skip this.** The repo's real project is
live; this sandbox can't reach `gstatic.com`/Firestore at all, which is
itself exercised as the "Firebase unreachable degrades gracefully" case
in every leaderboard test.

## Git workflow

Branch off latest `main` for every change, one PR per logical change,
never push directly to `main`. Commit messages and PR bodies end with
the attribution footer from the session's system prompt. Known open
PRs as of this writing: **#33** (service-worker cache-consistency,
already bumped `CACHE_NAME` on its own branch - expect a collision) and
**#13** (Laberinto neighbor-fan layout, unrelated/stale). Re-check
current PR state via the GitHub MCP tools before assuming either is
still open - this list goes stale.
