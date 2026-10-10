'use strict';

// Covers the leaderboard feature on /clasificador/ (its own
// 'clasificador-leaderboard' Firestore collection - see shared.js's
// submitLeaderboardScore/getTopLeaderboardScores). Ranked purely by
// score (total stations correctly classified), descending - same shape
// as Memoria's and Metro Crush's own leaderboards, no hardMode field at
// all since this game has no normal/hard mode toggle.
//
// This sandboxed test environment can't reach Firestore at all
// (gstatic.com is unreachable), which is itself a useful case to cover:
// the leaderboard section must still render (an empty-state message,
// not an error) and the page must not throw.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedResult(page, dateKey, total, correctByLine, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    localStorage.setItem('clasificador:' + args.dateKey, JSON.stringify({
      total: args.total,
      correctByLine: args.correctByLine,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, total: total, correctByLine: correctByLine, leaderboardSubmitted: leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2027-03-01';
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 14, { '1': 14 }, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted finished result');

      const titleText = await page.$eval('.leaderboard__title', (el) => el.textContent);
      assert.strictEqual(titleText, 'Mejores 5 puntajes hoy');

      // No Firestore reachable in this sandbox - getTopLeaderboardScores()
      // resolves to [] rather than throwing, so this should render the
      // empty-state message instead of an error.
      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message when Firebase is unreachable');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('shows a 🔥 × N streak badge (N > 1 only) per row, with a plain score cell, fed by getTopLeaderboardScores() extraFields', async () => {
    const DATE = '2027-03-02';
    const context = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.route('**/shared.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const patched = body + `
          (function () {
            var DATA = [
              { id: 'ana', alias: 'Ana', score: 31, streak: 8 },
              // A streak of 1 (not yet "a streak" worth calling out) and
              // no streak field at all (predates the field) should both
              // render nothing - same threshold as every other game's
              // own streak badge.
              { id: 'beto', alias: 'Beto', score: 20, streak: 1 },
              { id: 'caro', alias: 'Caro', score: 9 },
            ];
            window.MetroShared.getTopLeaderboardScores = function () {
              return Promise.resolve(DATA);
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/clasificador/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 9, { '1': 9 }, true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#leaderboard-list .leaderboard__row');
      assert.strictEqual(await rows.count(), 3);

      const scores = await rows.locator('.leaderboard__score--plain').allTextContents();
      assert.deepStrictEqual(scores, ['31', '20', '9']);

      const streaks = await rows.locator('.leaderboard__streak').allTextContents();
      assert.deepStrictEqual(streaks, ['🔥 × 8', '', ''], 'only a streak > 1 should render, everything else should show nothing');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('saving an alias from the reveal screen submits the already-finished round\'s score, even though it finished before an alias existed', async () => {
    const DATE = '2027-03-03';
    const context = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const submitted = [];
      await page.route('**/shared.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const patched = body + `
          (function () {
            window.MetroShared.getTopLeaderboardScores = function () { return Promise.resolve([]); };
            window.MetroShared.submitLeaderboardScore = function (collectionName, dateKey, alias, fields) {
              window.__submitted = window.__submitted || [];
              window.__submitted.push({ collectionName: collectionName, dateKey: dateKey, alias: alias, fields: fields });
              return Promise.resolve();
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/clasificador/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 18, { '1': 18 }, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const inputVisible = await page.locator('#leaderboard-alias-row input').isVisible();
      assert.strictEqual(inputVisible, true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Roberto');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(300);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Roberto'), 'should show the saved alias, got: ' + displayText);

      const submittedCalls = await page.evaluate(() => window.__submitted);
      assert.strictEqual(submittedCalls.length, 1, 'expected exactly one submitLeaderboardScore() call');
      assert.strictEqual(submittedCalls[0].collectionName, 'clasificador-leaderboard');
      assert.strictEqual(submittedCalls[0].alias, 'Roberto');
      assert.strictEqual(submittedCalls[0].fields.score, 18, 'should submit the already-finished round\'s total as score');

      const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem('clasificador:' + k)), DATE);
      assert.strictEqual(stored.leaderboardSubmitted, true, 'leaderboardSubmitted should be persisted true after a successful submission');

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
