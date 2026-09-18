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
  distance + compass direction after each guess. Map is locked
  (no pan/zoom) while playing; unlocks and swaps in the target's real
  station-icon badge (Metro Crush's pictogram style, colored by line) once
  the round ends. Has its own leaderboard (see below) but **no committed
  Playwright tests yet** - only verified via ad-hoc scratchpad scripts
  so far, not `tests/`.
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
  streak tracking (localStorage), alias helpers, the leaderboard API
  (`submitLeaderboardScore`/`getTopLeaderboardScores`, collection- and
  field-shape-agnostic - see "Leaderboards" below), clipboard/share
  helpers (`shareOrCopyText`, native `navigator.share` with a
  clipboard-copy fallback), and `buildGamePromo(currentGameKey,
  dateKey)` for the "sigue jugando hoy" component on every game's own
  end screen - see "Game suggestions" below.
- **`shared.css`** - design tokens (`:root` custom properties, light +
  dark via `prefers-color-scheme` and `[data-theme]`), the embedded
  Overpass font (base64 `@font-face`, huge single line - don't `cat`
  the whole file), and cross-game primitives (`.wrap`, `.brand`,
  `.sign`, `.date-debug`/`.chev` date-nav, `.btn-primary`/`.btn-secondary`,
  `.leaderboard*`). Game-specific CSS (including a game's own
  leaderboard sizing deltas, if any) lives in that page's own `<style>`
  block - **put any leaderboard styling shared by 2+ games in
  `shared.css`, not copy-pasted per page** (already happened once).
- **`firebase-config.js`** - **contains the real, live Firebase
  project's credentials on `main`.** See "Firebase credential safety"
  below before ever running tests locally.
- **`firestore.rules`** - hand-maintained (no CLI/CI deploy pipeline -
  paste into the Firebase console manually). One `match` block per
  leaderboard collection, validating shape/type/bounds only (no login
  system exists, so these can't verify a human played fair - accepted
  tradeoff for a casual leaderboard).
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
asc is always auto-appended as the final tiebreak by
`getTopLeaderboardScores()` itself):
- Metrordle: fewest attempts, hard-mode beats normal-mode at a tie
  (`[['attempts','asc'],['hardMode','desc']]` - relies on Firestore/the
  JS comparator ordering `false < true`).
- Laberinto: fewest stations, then fewest transfers, both ascending.
- Memoria: highest score, descending.
- Metroguessr: fewest attempts, ascending (`[['attempts','asc']]`) - like
  Metrordle/Laberinto, not Memoria: a loss has no meaningful "attempts to
  solve," so (see below) it only submits on a win.
- Metro Crush: highest score, descending - same shape as Memoria's, but
  a cumulative round total rather than a fixed-size puzzle's score, so
  its Firestore rule bounds `score` generously (20000) instead of
  tightly (see `firestore.rules`).

Submission pattern (identical across all 5 games): a
`leaderboardSubmitted` flag persisted alongside the game result, so a
reload never resubmits; `submitScore()` no-ops without an alias, under
`?debug=true`, or (Metrordle/Laberinto/Metroguessr only) on a loss/give-up
- only a genuine win has a meaningful score to rank. `renderLeaderboard()` never
clears the DOM before its fetch resolves (avoids a flicker on reload),
guarded by a monotonically increasing request-id so a stale response
can't paint over a newer one.

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
