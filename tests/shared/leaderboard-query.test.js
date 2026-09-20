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
// Also covers the related options.extraFields parameter - which fields
// beyond orderBySpecs actually get copied from the Firestore document
// into the entry object a caller receives. This one isn't a Firestore
// quirk, it's this function's OWN behavior: only orderBySpecs fields
// were ever copied over until extraFields existed, which silently kept
// Metroguessr's own hintsUsed field (submitted correctly, but never
// requested via extraFields until this same change added it) from ever
// reaching that page's own renderLeaderboard() in production.
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

  test('options.extraFields copies a display-only field (e.g. streak) into the returned entries - and omitting it leaves the field off, not erroring', async () => {
    const DATE = '2026-12-19';
    const FIXTURE = {
      'metrordle-leaderboard': {
        [DATE]: [
          { id: 'ana', data: { alias: 'Ana', attempts: 1, hardMode: false, streak: 7, submittedAt: 1000 } },
          // No streak field at all - simulates an entry submitted
          // before streak existed on this collection. Since streak is
          // never part of orderBySpecs, this must NOT be excluded from
          // the results the way a missing orderBySpecs field would be
          // (see the other test in this file) - it should just come
          // back with streak: undefined.
          { id: 'beto', data: { alias: 'Beto', attempts: 2, hardMode: false, submittedAt: 2000 } },
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

      const withExtraField = await page.evaluate((dateKey) => {
        return MetroShared.getTopLeaderboardScores('metrordle-leaderboard', dateKey, 5, [['attempts', 'asc'], ['hardMode', 'desc']], { extraFields: ['streak'] });
      }, DATE);
      assert.strictEqual(withExtraField[0].streak, 7, 'requesting streak via extraFields should copy it onto the entry');
      assert.strictEqual(withExtraField[1].streak, undefined, 'an entry missing the field entirely should come back with it undefined, not excluded or defaulted');
      assert.strictEqual(withExtraField.length, 2, 'a field missing from an entry, when it is NOT part of orderBySpecs, must never exclude that entry from the results');

      // The bug this guards against: Metroguessr's own hintsUsed field
      // was rendered by that page's renderLeaderboard() for a full PR
      // before its own getTopLeaderboardScores() call was ever updated
      // to actually request it - every real entry's badge silently
      // stayed empty in production despite the field being correctly
      // submitted, since nothing without extraFields ever copied it
      // from the Firestore document into the returned entry.
      const withoutExtraField = await page.evaluate((dateKey) => {
        return MetroShared.getTopLeaderboardScores('metrordle-leaderboard', dateKey, 5, [['attempts', 'asc'], ['hardMode', 'desc']], {});
      }, DATE);
      assert.strictEqual(withoutExtraField[0].streak, undefined, 'without extraFields, a non-orderBySpecs field should not be copied even when the document has it');

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
