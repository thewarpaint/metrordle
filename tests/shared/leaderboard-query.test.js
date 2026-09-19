'use strict';

// Covers MetroShared.getTopLeaderboardScores()'s real Firestore
// query-construction logic (shared.js), using tests/lib/firestore-stub.js
// to fake just enough of the Firestore compat SDK's query surface to
// reproduce a real Firestore behavior no other test here exercises:
// .orderBy(field) EXCLUDES a document missing that field entirely from
// the results, rather than erroring or treating it as a default value.
// That's exactly what silently broke /admin/'s Metroguessr leaderboard
// in production once hardMode was added to its orderBySpecs - every
// entry submitted before that (with no hardMode field at all) vanished
// from every query that ordered by it, with no error anywhere.
//
// Every OTHER leaderboard test in this suite only reaches
// getTopLeaderboardScores()'s "Firebase unreachable, degrade
// gracefully" early return (this sandboxed environment can't reach a
// real Firestore project at all) - useful coverage in its own right,
// but it says nothing about whether the query itself is correct, which
// is what this file is for.
//
// Loads /admin/ as the host page purely because it's the simplest
// existing caller of getTopLeaderboardScores() for an arbitrary
// collection/date - nothing here is specific to /admin/ itself.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { installFirestoreStub } = require('../lib/firestore-stub');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('an entry missing a later orderBySpecs field (e.g. hardMode) still appears, ranked as if that field were false', async () => {
    const DATE = '2026-12-18';
    const FIXTURE = {
      'metroguessr-leaderboard': {
        [DATE]: [
          // Fewest attempts wins outright, regardless of hardMode.
          { id: 'dani', data: { alias: 'Dani', attempts: 1, hardMode: false, submittedAt: 4000 } },
          // Tied on attempts=2: hardMode:true beats hardMode:false beats
          // no hardMode field at all (treated as false) - Beto and Caro
          // then tiebreak on submittedAt ascending.
          { id: 'ana', data: { alias: 'Ana', attempts: 2, hardMode: true, submittedAt: 1000 } },
          { id: 'beto', data: { alias: 'Beto', attempts: 2, hardMode: false, submittedAt: 2000 } },
          // No hardMode field at all - simulates an entry submitted
          // before hardMode existed on this collection. The bug: a
          // compound Firestore orderBy('attempts').orderBy('hardMode')
          // query drops this row entirely instead of ranking it last
          // among its attempts=2 peers.
          { id: 'caro', data: { alias: 'Caro', attempts: 2, submittedAt: 3000 } },
        ],
      },
    };

    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installFirestoreStub(page, FIXTURE);
      await page.goto(server.baseUrl + '/admin/?date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#metroguessr-list .leaderboard__row');
      const names = await rows.locator('.leaderboard__alias-name').allTextContents();
      assert.deepStrictEqual(names, ['Dani', 'Ana', 'Beto', 'Caro'], 'expected Caro (no hardMode field) to still appear, ranked last among the attempts=2 tier');

      const badges = await rows.locator('.leaderboard__score-badge').allTextContents();
      assert.deepStrictEqual(badges, ['', '🧠', '', ''], 'expected only Ana (hardMode: true) to show the badge - Caro\'s missing field should NOT render as true');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  const failed = await runAll();
  await browser.close();
  server.stop();
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
