'use strict';

// Covers the leaderboard feature on /metrocrush/ (its own
// 'metrocrush-leaderboard' Firestore collection - see shared.js's
// submitLeaderboardScore/getTopLeaderboardScores). Ranked purely by
// score, descending - hardMode isn't part of orderBySpecs here (hard
// mode already doubles every point scored, so there's no tie to break
// on it), so both hardMode and streak have to be requested via
// options.extraFields or getTopLeaderboardScores() never copies them
// onto the entry at all (see metrocrush/index.html's own
// renderLeaderboard() comment). This is the exact bug class that shipped
// twice for this one page already - the 🧠 badge silently never showed
// for any real entry until extraFields named it, and the 🔥 streak
// badge (shown on every OTHER game's own leaderboard, and on /admin/'s
// cross-game view of this same collection) was simply never added to
// this page's own renderLeaderboard() at all until now. Locking both in
// here.
//
// This sandboxed test environment can't reach Firestore at all
// (gstatic.com is unreachable), which is itself a useful case to cover:
// the leaderboard section must still render (an empty-state message,
// not an error) and the page must not throw.
//
// Metro Crush has no round-in-progress state to resume (the board isn't
// persisted, only the finished round's own stats are - see
// metrocrush/index.html's own startNewGame() comment), so reaching the
// reveal screen just means planting a finished result directly in
// localStorage and reloading, same "plant saved state, reload" trick
// every other game's own leaderboard tests use.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedResult(page, dateKey, score, mode, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    localStorage.setItem('metrocrush:' + args.dateKey, JSON.stringify({
      score: args.score,
      mode: args.mode,
      groupsFormed: 5,
      maxCombo: 2,
      maxRunSeen: 4,
      matchCountsByLine: {},
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, score: score, mode: mode, leaderboardSubmitted: leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2027-02-01';
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/metrocrush/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 300, 'normal', false);
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

  test('shows both the 🧠 hard-mode badge and a 🔥 × N streak badge (N > 1 only) per row, fed by getTopLeaderboardScores() extraFields', async () => {
    const DATE = '2027-02-02';
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
              { id: 'ana', alias: 'Ana', score: 900, hardMode: true, streak: 8 },
              // A streak of 1 (not yet "a streak" worth calling out) and
              // no streak field at all (predates the field) should both
              // render nothing - same threshold as every other game's
              // own streak badge.
              { id: 'beto', alias: 'Beto', score: 500, hardMode: false, streak: 1 },
              { id: 'caro', alias: 'Caro', score: 300, hardMode: false },
            ];
            window.MetroShared.getTopLeaderboardScores = function () {
              return Promise.resolve(DATA);
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/metrocrush/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 300, 'normal', true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#leaderboard-list .leaderboard__row');
      assert.strictEqual(await rows.count(), 3);

      const badges = await rows.locator('.leaderboard__score-badge').allTextContents();
      assert.deepStrictEqual(badges, ['🧠', '', ''], 'only Ana (hardMode: true) should show the brain badge');

      const streaks = await rows.locator('.leaderboard__streak').allTextContents();
      assert.deepStrictEqual(streaks, ['🔥 × 8', '', ''], 'only a streak > 1 should render, everything else should show nothing');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('shows Metro Crush\'s own all-time high score next to its leaderboard, fed by MetroShared.getHighScoreRecord() - and stays hidden with no record yet', async () => {
    const DATE = '2027-02-03';
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
            window.MetroShared.getHighScoreRecord = function (gameKey) {
              return Promise.resolve(gameKey === 'metrocrush' ? { score: 3065, alias: 'Facso', dateKey: '2026-09-22', gameNumber: 11 } : null);
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/metrocrush/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 300, 'normal', true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#leaderboard-record').isVisible(), true, 'Metro Crush has a real record - should show');
      assert.strictEqual(await page.locator('#leaderboard-record').textContent(), '🏆 Récord: 3065 por Facso · #11 · 22 sep 2026');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('hides the high score record when none exists yet, not "🏆 Récord: undefined"', async () => {
    const DATE = '2027-02-04';
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
            window.MetroShared.getHighScoreRecord = function () { return Promise.resolve(null); };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/metrocrush/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 300, 'normal', true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#leaderboard-record').isVisible(), false, 'no record yet - should stay hidden');

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
