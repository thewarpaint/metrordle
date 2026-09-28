'use strict';

// Covers MetroShared.updateHighScoreRecord()/getHighScoreRecord() (see
// shared.js's own comment, and firestore.rules' matching records/{gameKey}
// block) - the all-time-highest-score tracker for Memoria and Metro
// Crush. The existing tests/lib/firestore-stub.js only simulates the
// query surface (collection().doc().collection().orderBy().limit().get())
// getTopLeaderboardScores() uses - this function uses a different shape
// entirely (a single top-level records/{gameKey} document, read and
// conditionally written inside a runTransaction()), so this file
// installs its own minimal in-page Firestore fake covering just that
// shape, rather than stretching the query stub to cover both.
//
// This sandboxed test environment can't reach Firestore at all
// (gstatic.com is unreachable), which is itself a useful case to cover:
// both functions must degrade gracefully (never reject, never throw)
// rather than erroring when Firebase isn't reachable.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

// initialRecord: undefined (doc doesn't exist yet) or { score, alias,
// dateKey } to seed records/{gameKey} with before the test's own calls.
async function installMinimalFirebaseMock(page, initialRecord) {
  await page.addInitScript((seed) => {
    var STORE = {};
    if (seed) STORE['records/' + seed.gameKey] = seed.record;

    window.__store = STORE;
    window.firebase = {
      apps: [{ name: '[DEFAULT]' }],
      initializeApp: function () {},
      firestore: function () {
        return {
          collection: function (collectionName) {
            return {
              doc: function (docId) {
                var path = collectionName + '/' + docId;
                return {
                  path: path,
                  // Plain (non-transactional) read - getHighScoreRecord()'s
                  // own call shape, separate from the transaction object's
                  // own get()/set() below.
                  get: function () {
                    var data = STORE[path];
                    return Promise.resolve({ exists: !!data, data: function () { return data; } });
                  },
                };
              },
            };
          },
          runTransaction: function (updateFn) {
            var transaction = {
              get: function (ref) {
                var data = STORE[ref.path];
                return Promise.resolve({ exists: !!data, data: function () { return data; } });
              },
              set: function (ref, data) {
                STORE[ref.path] = data;
              },
            };
            return Promise.resolve(updateFn(transaction));
          },
        };
      },
    };
    window.firebase.firestore.FieldValue = { serverTimestamp: function () { return 'SERVER_TIMESTAMP'; } };
  }, initialRecord);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('updateHighScoreRecord() creates the record on the first-ever submission for a game', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installMinimalFirebaseMock(page, null);
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const result = await page.evaluate(() => {
        return MetroShared.updateHighScoreRecord('memoria', 12, 'Ana', '2027-02-15');
      });
      assert.strictEqual(result.isNewRecord, true);
      assert.strictEqual(result.record.score, 12);
      assert.strictEqual(result.record.alias, 'Ana');

      const stored = await page.evaluate(() => window.__store['records/memoria']);
      assert.strictEqual(stored.score, 12, 'the record should actually be persisted in the store');

      assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('updateHighScoreRecord() overwrites only when the new score is strictly higher, never on a tie or a lower score', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installMinimalFirebaseMock(page, { gameKey: 'metrocrush', record: { score: 1000, alias: 'Beto', dateKey: '2027-02-01' } });
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const lower = await page.evaluate(() => MetroShared.updateHighScoreRecord('metrocrush', 500, 'Caro', '2027-02-16'));
      assert.strictEqual(lower.isNewRecord, false, 'a lower score should never overwrite the record');
      assert.strictEqual(lower.record.alias, 'Beto', 'should return the EXISTING record, not the rejected attempt');

      const tie = await page.evaluate(() => MetroShared.updateHighScoreRecord('metrocrush', 1000, 'Diego', '2027-02-17'));
      assert.strictEqual(tie.isNewRecord, false, 'a tied score should not overwrite - the earlier holder keeps it, matching firestore.rules\' own strict ">" requirement');

      const higher = await page.evaluate(() => MetroShared.updateHighScoreRecord('metrocrush', 1500, 'Ana', '2027-02-18'));
      assert.strictEqual(higher.isNewRecord, true);
      assert.strictEqual(higher.record.score, 1500);

      const finalStored = await page.evaluate(() => window.__store['records/metrocrush']);
      assert.strictEqual(finalStored.score, 1500, 'only the genuinely higher score should have persisted');
      assert.strictEqual(finalStored.alias, 'Ana');

      assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('getHighScoreRecord() reads the stored record, and both functions degrade gracefully (never reject) with no reachable Firebase', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installMinimalFirebaseMock(page, { gameKey: 'memoria', record: { score: 39, alias: '🐱', dateKey: '2026-09-20' } });
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const record = await page.evaluate(() => MetroShared.getHighScoreRecord('memoria'));
      assert.deepStrictEqual(record, { score: 39, alias: '🐱', dateKey: '2026-09-20' });

      const missing = await page.evaluate(() => MetroShared.getHighScoreRecord('metrocrush'));
      assert.strictEqual(missing, null, 'a game with no record yet should resolve null, not throw');

      assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('both functions degrade gracefully (resolve, never reject) when Firebase is unreachable, same as the rest of the leaderboard API', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      // No installMinimalFirebaseMock() call here, and /configurar/
      // itself never loads the Firebase SDK at all (it's the settings
      // page, no leaderboard of its own) - window.firebase stays
      // undefined, same as any real player behind a network that blocks
      // Firebase (which this sandbox also can't reach, for other pages
      // that do load it).
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const updateResult = await page.evaluate(() => MetroShared.updateHighScoreRecord('memoria', 50, 'Ana', '2027-02-19'));
      assert.deepStrictEqual(updateResult, { isNewRecord: false, record: null });

      const readResult = await page.evaluate(() => MetroShared.getHighScoreRecord('memoria'));
      assert.strictEqual(readResult, null);

      assert.strictEqual(errors.length, 0, JSON.stringify(errors));
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
