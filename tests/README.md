# Tests

End-to-end tests for the Metrordle minigame family, driven with
[Playwright](https://playwright.dev/). There's no build step for the
site itself, so these tests load the real static files directly - each
test file spins up a plain `python3 -m http.server` rooted at the repo
and drives it with a real (headless) browser, the same way a player's
browser would.

Memoria (`memoria/`) has the fullest coverage; Metroguessr
(`metroguessr/`) has core-mechanics + leaderboard coverage; Laberinto
(`laberinto/`) has a puzzle-difficulty check alongside its leaderboard
coverage; the main game (`metrordle/`) and the admin leaderboard
browser (`admin/`) have leaderboard coverage only so far;
Metro Crush (`metrocrush/`) has none committed yet - still only the
ad-hoc scratchpad checks used during development. `configurar/` covers
the site-wide settings page (`/configurar/`). `security/` and `shared/`
cover site-wide/cross-game checks (the CSP, and `shared.js`'s
leaderboard query logic, respectively) that aren't specific to any one
game. Add new games/checks under their own subdirectory following the
same pattern.

Metroguessr's own tests stub the real map (Leaflet/MapLibre/OpenFreeMap)
via `tests/lib/leaflet-stub.js` - see that file's comment for why this
is the one dependency in the whole suite that gets a fake instead of
being left to fail gracefully like Firebase everywhere else (it's a
hard rendering dependency, not an optional one). `shared/leaderboard-query.test.js`
similarly fakes the Firestore compat SDK's query surface itself
(`tests/lib/firestore-stub.js`) - the one place in the whole suite that
needs to exercise a REAL (simulated) Firestore query rather than just
the "Firebase unreachable" path every other leaderboard test covers.

## Setup

Requires Node.js 18+ and Python 3 (for the local static server).

```sh
cd tests
npm install
npx playwright install chromium
```

## Running

From the `tests/` directory:

```sh
npm test               # everything (~95s total)
npm run test:fast       # fast checks only (~15s)
npm run test:leaderboard  # Memoria's leaderboard checks (~10s)
npm run test:lifecycle  # the round-completion checks only (~65s)
npm run test:laberinto  # Laberinto's puzzle-difficulty checks (~15s)
npm run test:laberinto-leaderboard  # Laberinto's leaderboard checks (~10s)
npm run test:metrordle-leaderboard  # the main game's leaderboard checks (~10s)
npm run test:metroguessr  # Metroguessr's core-mechanics checks (~15s)
npm run test:metroguessr-theme  # Metroguessr's map-tile/theme-override checks (~10s)
npm run test:metroguessr-leaderboard  # Metroguessr's leaderboard checks (~10s)
npm run test:admin  # the /admin/ leaderboard browser checks (~10s)
npm run test:configurar  # the /configurar/ settings page checks (~10s)
npm run test:leaderboard-query  # getTopLeaderboardScores()'s real Firestore query logic (~10s)
npm run test:csp  # Content-Security-Policy checks, every page (~10s)
```

Or run a file directly: `node memoria/fast.test.js`.

Each file manages its own server and browser and exits non-zero if any
check inside it fails, with a stack trace printed for each failure - so
`npm test` (via `run.js`) is safe to wire into CI as-is.

### Ports

Tests default to `localhost:8930` for the static server. Override with
`METRORDLE_TEST_PORT` if that port is taken:

```sh
METRORDLE_TEST_PORT=9001 npm test
```

## What's covered

**`memoria/fast.test.js`** (no real-time waiting beyond a couple of
seconds):
- The "Comenzar" start dialog blocks the board (cards disabled) until
  dismissed, then reveals it.
- The round timer actually counts down once started.
- The icon/name checkerboard pattern holds on the initial board.
- Matching a pair repositions exactly 4 cards (the refilled pair + two
  existing cards) once the reshuffle's own slide settles, and the
  checkerboard + "8 unique stations, each paired" invariants still hold
  afterward.
- A match deals the refilled pair onto the board immediately (no delay,
  no flash of its own) while the just-matched pair gets a `--match-bg`
  -colored `.memo-card--match-ghost` clone of itself, positioned over its
  old spot outside `#memo-board` entirely, that pops and fades away on
  its own; a same-colored "+1" `.memo-score-popup` rises over where the
  match happened at the same time. Both are gone once `MATCH_FLASH_MS`
  (200ms) passes, and neither ever blocks the rest of the board.
- The same date produces an identical board across two independent
  browser sessions (the daily puzzle is deterministic).
- `?debug=true` date navigation loads a different day's board.

**`memoria/round-lifecycle.test.js`** (lets the 60s timer run out for
real, so it's slower):
- Reloading mid-round restarts today's puzzle with a fresh clock
  instead of resuming a stale one.
- A round played to completion persists the right score/streak, shows
  the correct reveal banner and rating, and copies the exact expected
  share text to the clipboard.
- Reloading after a result is saved shows that same result instead of
  starting a new round.
- The reveal's matched-station icons render grouped by line (not match
  order).

**`memoria/leaderboard.test.js`** (no real-time waiting - plants a saved
result directly in `localStorage` to reach the reveal screen instantly),
covering the leaderboard section on the real `/memoria/` page (its own
`memoria-leaderboard` Firestore collection, no localStorage fallback):
- The leaderboard section renders above the matched-icons grid, with the
  right title, and degrades gracefully to an empty-state message rather
  than erroring when Firebase isn't reachable (this sandboxed environment
  can't reach `gstatic.com` at all, which doubles as a real "player whose
  network blocks Firebase" case).
- Saving an alias persists it under the site-wide `metrordle:alias` key
  and shows the "Jugando como: ..." display, without a page error, even
  under `?debug=true`.
- A play under `?debug=true` never marks `leaderboardSubmitted` true -
  date-nav testing shouldn't pollute the real leaderboard.
- Each row shows a "🔥 × N" streak badge (stubbed `getTopLeaderboardScores()`
  data, `N > 1` only - a streak of 1 or a missing field both render
  nothing) via the shared `MetroShared.buildStreakBadge()`.

None of this exercises a real Firestore submission landing and rendering
(sorted, tie-broken, highlighting the current player's row) end to end,
since no live Firebase project's credentials belong in this repo and the
real page has no localStorage fallback to fall back to instead. Once a
real project is wired up in `firebase-config.js`, do a manual smoke test
against it: confirm a normal play submits a score visible in the Firebase
console under `memoria-leaderboard`, and that playing under `?debug=true`
does not.

**`memoria/share.test.js`** (same saved-result-planting trick, no
real-time waiting) covers the "Compartir" button's `navigator.share()`
path specifically - Playwright's Chromium has no Web Share API by
default, so `round-lifecycle.test.js`'s real completed round only ever
exercises the clipboard-copy fallback. Stubs `navigator.share` to check:
it's called with the correctly-built share text; a cancelled share sheet
(`AbortError`) does *not* also fall back to a clipboard copy; a share
sheet that fails for another reason *does* fall back, with the button
showing the clipboard-copy confirmation label.

**`laberinto/fast.test.js`** (no real-time waiting - origin/destination
show in the header as soon as a page loads, without needing to solve
anything) covers the daily puzzle's difficulty floor
(`getPuzzleForDateKey()`'s `PATH_DIFFICULTY_CUTOVER_DATE_KEY` split,
added after Game #23 slipped through as a 6-hop, zero-transfer puzzle -
origin/destination are always drawn from two different lines, but the
actual shortest route can still avoid transferring if either endpoint
happens to also sit on some third, shared line). Each check
independently recomputes the shortest-path stats for the shown
origin/destination via its own BFS over `window.MetroShared.LINES`,
deliberately not calling into the app's own (closure-private)
`shortestPath()`:
- Every date on or after the cutover (2026-09-20) needs both a 10+ stop
  walk and at least one real transfer.
- Game #23 (2026-09-17) itself, and the day right before the cutover,
  still only need to clear the old floor (>= 6 stops, no transfer
  requirement) - proving the new rule doesn't retroactively change an
  already-played day's puzzle.

**`laberinto/leaderboard.test.js`** (no real-time waiting - plants a
"won" state with a fabricated path directly in `localStorage`, since
`loadSavedState()` only checks that `path` is a non-empty array, not
that it's a real solve), covering the leaderboard section on
`/laberinto/` (its own `laberinto-leaderboard` Firestore collection, no
localStorage fallback). Ranked the opposite direction from Memoria's:
fewer stations wins, fewer transfers breaks a tie, both ascending -
entries render as `stations-transfers` (e.g. `12-2`) rather than a
single number:
- The leaderboard section renders above the optimal-route details, with
  the right title, and degrades gracefully to an empty-state message
  rather than erroring when Firebase isn't reachable.
- Saving an alias persists it under the site-wide `metrordle:alias` key,
  without a page error, even under `?debug=true`.
- A play under `?debug=true` never marks `leaderboardSubmitted` true.
- Giving up never has anything to submit (there's no route to rank) -
  `leaderboardSubmitted` stays false, but the leaderboard section still
  renders without error.
- Each row shows a "🔥 × N" streak badge (stubbed `getTopLeaderboardScores()`
  data, `N > 1` only), same as Metrordle's own.

Same real-Firestore-submission coverage gap as Memoria's leaderboard
test, for the same reason (no live Firebase project's credentials belong
in this repo, and the real page has no localStorage fallback).

**`metrordle/leaderboard.test.js`** (no real-time waiting - plants a
fabricated `history` array directly in `localStorage`, since
`loadSavedState()` only checks that `history` is an array, not that the
guesses are real), covering the leaderboard section on the main game
(its own `metrordle-leaderboard` Firestore collection, no localStorage
fallback). One combined leaderboard, not split by normal/hard mode:
fewer attempts wins, a loss always sorts after every win, and a
hard-mode entry beats a normal-mode entry at the same attempts count -
entries render as the attempts count (or "-" for a loss) with a "🧠"
suffix on hard-mode ones:
- The leaderboard section renders above the guess-board details, with
  the right title, and degrades gracefully to an empty-state message
  rather than erroring when Firebase isn't reachable.
- Saving an alias persists it under the site-wide `metrordle:alias` key,
  without a page error, even under `?debug=true`.
- A play under `?debug=true` never marks `leaderboardSubmitted` true.
- A loss now submits too (`attempts: 5, lost: true`, captured via a
  route-intercepted, patched `submitLeaderboardScore()`) once an alias
  is set, and shows the alias row instead of hiding it - a real
  submission attempt this sandboxed environment can't fully verify
  landing in Firestore (see the coverage-gap note below), but this at
  least proves `submitScore()` no longer skips a loss the way it used
  to.
- A lost entry renders "-" instead of an attempts number (stubbed
  `getTopLeaderboardScores()` data), ranked after a tied-attempts win -
  the real sort logic behind that ordering is covered by
  `shared/leaderboard-query.test.js` instead.
- Each row shows a "🔥 × N" streak badge (stubbed `getTopLeaderboardScores()`
  data, `N > 1` only), same as `/admin/`'s own copy of this check.

Same real-Firestore-submission coverage gap as Memoria's leaderboard
test, for the same reason.

**`metroguessr/fast.test.js`** (no real-time waiting - guessing has no
timer, unlike Memoria/Metro Crush's 60s round) covers the core game
loop with the real map stubbed (see `tests/lib/leaflet-stub.js`):
- The daily target is deterministic - two independent sessions on the
  same date reveal the same station.
- No two of ten consecutive dates on or after `NO_REPEAT_CUTOVER_DATE_KEY`
  (2026-09-18, see `metroguessr/index.html`'s `pickTarget()`) reveal the
  same target - the no-repeat guarantee the `STATION_ORDER` permutation
  is meant to provide.
- A wrong guess adds exactly one distance+direction history chip;
  guessing the real target ends the round immediately as a win.
- Five wrong guesses end the round as a loss, with a single-line reveal
  (`.reveal__line`, not two separate paragraphs) and the history chips
  hidden once the round is over.
- The reveal shows the target's own station-icon badge, colored by its
  line, matching the pictogram Metrordle/Metro Crush already use.
- The debug-only distance/direction map pins (see
  `paintGuessMarkers()`) don't render outside `?debug=true`, and under
  it collapse a repeated wrong guess to a single pin.
- Reloading mid-round restores the guesses so far (not the reveal);
  reloading after the round ends restores the same reveal/result
  instead of starting over, and a further guess attempt on an
  already-done day is a no-op.

**`metroguessr/theme.test.js`** covers a bug found right after
`/configurar/` shipped: the map tile style was queried straight from
`prefers-color-scheme`, bypassing a saved light/dark override
entirely, so the map tiles could end up a different theme than the
rest of the page's own chrome:
- An explicit "Claro"/"Oscuro" override picks that style regardless of
  the OS preference.
- "Sistema", or no saved config at all, still follows the OS
  preference either way - the fix doesn't change the pre-existing
  default behavior.

**`metroguessr/leaderboard.test.js`** (no real-time waiting - plants a
fabricated `guesses` array directly in `localStorage`, since
`loadSavedState()` only checks that `guesses` is an array and looks at
the last entry's `correct` flag, not that it's the real target), same
structure as `metrordle/leaderboard.test.js` above - fewest attempts
wins, a loss always after every win, no hard-mode split beyond the
existing hard-mode tiebreak:
- The leaderboard section renders with the right title, and degrades
  gracefully to an empty-state message rather than erroring when
  Firebase isn't reachable.
- Saving an alias persists it under the site-wide `metrordle:alias` key,
  without a page error, even under `?debug=true`.
- A play under `?debug=true` never marks `leaderboardSubmitted` true.
- A loss now submits too (`attempts: 5, lost: true`, same
  patched-`submitLeaderboardScore()` trick as Metrordle's own test) once
  an alias is set, and shows the alias row instead of hiding it.
- A lost entry renders "-" instead of an attempts number, ranked after
  a tied-attempts win - same as Metrordle's own leaderboard.

Same real-Firestore-submission coverage gap as Memoria's leaderboard
test, for the same reason.

**`admin/admin.test.js`** covers `/admin/`, the read-only cross-game
leaderboard browser (no game state of its own to plant in
`localStorage` - it just reads all three games' own collections):
- The date picker (the same prev/next chevrons as each game's own
  `?debug=true` date-nav) and each game's "Ver este día en ___" deep
  link are both hidden without `?debug=true`, shown only with it - and
  all three games' sections degrade gracefully to an empty-state
  message when Firebase isn't reachable either way.
- Under `?debug=true`, the date picker defaults to today; clicking the
  chevrons moves the shown date a real calendar day at a time, and each
  game's deep link tracks whatever date is currently shown.
- Real leaderboard data (stubbed via a route-intercepted, patched
  `shared.js`, since this sandboxed environment can't reach Firestore)
  renders with each game's own ranking and score formatting: Metrordle's
  badge+number cell (a lost entry shows "-"), Laberinto's
  `stations-transfers`, Memoria's plain score.
- The two `.stat-grid`/`.stat-box` tiles above the boards (unique
  aliases and total entries across every game that day) render
  correctly from the same sample data, including with no reachable
  Firebase (0/0) - and are NOT debug-gated, unlike the date-nav/deep
  links above.

**`configurar/config.test.js`** covers `/configurar/`, the site-wide
settings page (for now, just the light/dark/system appearance picker -
see AGENTS.md's "Site config" section):
- With no saved config, "Sistema" shows selected and no `data-theme`
  override is applied to `<html>`.
- Picking "Oscuro"/"Claro" persists `{mode: 'dark'|'light'}` to the
  `metrordle:config` localStorage key and applies the matching
  `data-theme` attribute immediately, no reload needed; picking
  "Sistema" removes the attribute entirely rather than setting it to
  some third value.
- A saved mode survives a reload, applied before `shared.js` itself
  even runs (checked at `domcontentloaded`, not after `networkidle`) -
  proving the page's own `<head>` flash-prevention snippet does the
  job, not `shared.js`'s later, redundant safety-net re-application.
- A mode saved on `/configurar/` also applies on an unrelated page
  (`/`) - the setting is site-wide, not scoped to the settings page
  itself.
- Saving a mode merges into, rather than replaces, whatever's already
  in the config object - the whole point of a single growable object
  instead of one localStorage key per setting.

**`shared/leaderboard-query.test.js`** covers `MetroShared.getTopLeaderboardScores()`'s
real Firestore query-construction logic in `shared.js` - unlike every
leaderboard test above (which only ever exercises its "Firebase
unreachable, degrade gracefully" early return, since this sandboxed
environment can't reach a real Firestore project at all), this one
fakes just enough of the Firestore compat SDK's query surface itself
(`tests/lib/firestore-stub.js`) to run the real query-building code
against realistic Firestore semantics. Specifically reproduces the bug
that broke `/admin/`'s Metroguessr leaderboard in production: an entry
submitted before a later `orderBySpecs` field (e.g. `hardMode`) existed
on that collection has no such field at all, and Firestore's own
`.orderBy(field)` silently **excludes** any document missing that
field from the results - no error, just fewer rows. See AGENTS.md's
"Leaderboards" section for the fix (`getTopLeaderboardScores()` only
ever orders by `orderBySpecs[0]` server-side, then applies the rest
client-side).
- An entry missing a later `orderBySpecs` field (`hardMode`) still
  appears in the results, correctly ranked as if that field were
  `false` - not silently dropped.
- The 🧠 badge only shows for an entry that actually has `hardMode:
  true` - a missing field must not render as truthy.
- A loss (`lost: true`) ranks after every win at the same attempts
  count, and an entry predating the `lost` field (no such field at
  all, from before Metrordle/Metroguessr started submitting losses)
  still appears in the results, ranked as a win - proving
  `orderBySpecs[0]` staying `attempts` (rather than becoming `lost`
  itself) avoids the exact same silent-exclusion risk as the `hardMode`
  case above.

**`security/csp.test.js`** guards the Content-Security-Policy `<meta>`
tag every page carries (defense-in-depth alongside the app's actual XSS
mitigation - every leaderboard alias render uses `textContent`, never
`innerHTML`, see each `*/leaderboard.test.js` above):
- Every page (`/`, `/memoria/`, `/laberinto/`, `/metroguessr/`,
  `/metrocrush/`, `/admin/`, `/configurar/`, `/purge/`) loads with zero
  `securitypolicyviolation` events and zero page errors - a policy
  that's too strict would otherwise silently break the page's own
  inline `<script>`, its embedded font, the Firebase SDK, or (for
  Metroguessr specifically) Leaflet/MapLibre/OpenFreeMap. Unlike every
  other page's Firebase dependency, Metroguessr's map is NOT optional -
  a network-restricted environment that can't reach those hosts will
  see this page itself fail to load (not a CSP violation), so this
  particular page's result here is only meaningful with real internet
  access.
- A positive control: a `fetch()` and a `<script src>` to a host
  deliberately left off the allowlist are both actually blocked - a
  regression here (rather than just "no violations") is what would catch
  a typo'd or misspelled policy that looks present in the HTML but isn't
  enforced at all.

## Adding a check

Each test file is a small standalone script (no test framework beyond
`playwright` + Node's built-in `assert`):

```js
const { test, runAll, startServer } = require('../lib/harness');

test('describes the expected behavior', async () => {
  // ... assert.strictEqual(...), etc.
});

// at the bottom of the file:
const failed = await runAll();
process.exitCode = failed ? 1 : 0;
```

`tests/lib/harness.js` has the server/test-registration plumbing;
`tests/lib/memoria-helpers.js` has DOM helpers for reading the board
(`getCells`, `matchOnePair`, `checkerboardOk`, ...) shared across
Memoria's own test files - reuse or extend those rather than
reimplementing board-reading logic per file.
