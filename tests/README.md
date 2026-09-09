# Tests

End-to-end tests for the Metrordle minigame family, driven with
[Playwright](https://playwright.dev/). There's no build step for the
site itself, so these tests load the real static files directly - each
test file spins up a plain `python3 -m http.server` rooted at the repo
and drives it with a real (headless) browser, the same way a player's
browser would.

Only Memoria has coverage today (`memoria/`). Add new games under their
own subdirectory following the same pattern.

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
npm run test:leaderboard  # the real page's leaderboard checks (~10s)
npm run test:lifecycle  # the round-completion checks only (~65s)
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
  existing cards), and the checkerboard + "8 unique stations, each
  paired" invariants still hold afterward.
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
