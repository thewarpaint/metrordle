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
npm run test:leaderboard  # alias + leaderboard checks (~15s)
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
result directly in `localStorage` to reach the reveal screen instantly):
- The alias input shows when none is saved; saving one persists it under
  the site-wide `metrordle:alias` key (not a Memoria-specific one) and
  switches to a "Jugando como: ... (Cambiar)" display.
- An alias saved from a previous visit shows the display row directly on
  load, without asking again.
- The leaderboard section degrades gracefully (an empty-state message,
  zero rows, zero JS errors) when no real Firebase project is configured
  - which is the checked-in default, see `firebase-config.js`.

These don't exercise real Firestore reads/writes, since no live Firebase
project's credentials belong in this repo. Once a real project is wired
up in `firebase-config.js`, do one manual smoke test against it: confirm
a normal play submits a score visible in the Firebase console, and that
playing under `?debug=true` does not.

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
