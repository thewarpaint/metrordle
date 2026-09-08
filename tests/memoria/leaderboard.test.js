'use strict';

// Covers the leaderboard feature on the REAL /memoria/ page (its own
// 'memoria-leaderboard' Firestore collection, no localStorage fallback -
// see shared.js's submitLeaderboardScore/getTopLeaderboardScores). This
// sandboxed test environment can't reach Firestore at all (gstatic.com is
// unreachable), which is itself a useful case to cover: the leaderboard
// section must still render (an empty-state message, not an error) and
// the page must not throw, exactly like a real player whose network
// blocks Firebase.
//
// See tests/memoria-leaderboard/leaderboard.test.js for the fuller
// submit/rank/tie-break behavior, already covered end to end there via
// the staging page's localStorage fallback.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedResult(page, dateKey, score, matchedStations, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    localStorage.setItem('memoria:' + args.dateKey, JSON.stringify({
      score: args.score,
      won: args.score >= 8,
      matchedStations: args.matchedStations,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, score: score, matchedStations: matchedStations, leaderboardSubmitted: leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders above the icons grid and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2026-12-01';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 3, ['Insurgentes'], false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted saved result');

      const titleText = await page.$eval('.leaderboard__title', (el) => el.textContent);
      assert.strictEqual(titleText, 'Mejores 5 puntajes hoy');

      const order = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#leaderboard, #reveal-icons'));
        return nodes.map((n) => n.id);
      });
      assert.deepStrictEqual(order, ['leaderboard', 'reveal-icons'], 'leaderboard should come before the icons grid in the DOM');

      // No Firestore reachable in this sandbox and no local fallback on
      // the real page (unlike staging) - getTopLeaderboardScores()
      // resolves to [] rather than throwing, so this should render the
      // empty-state message instead of an error.
      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message when Firebase is unreachable');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('saving an alias on the real page persists it site-wide without a page error, even under ?debug=true', async () => {
    const DATE = '2026-12-02';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 2, ['Zapata'], false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const inputVisible = await page.locator('#leaderboard-alias-row input').isVisible();
      assert.strictEqual(inputVisible, true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Eduardo');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(300);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Eduardo'), 'should show the saved alias, got: ' + displayText);

      const storedAlias = await page.evaluate(() => localStorage.getItem('metrordle:alias'));
      assert.strictEqual(storedAlias, 'Eduardo');

      // ?debug=true means submitScore() should skip entirely (see
      // memoria/index.html) - the saved result's leaderboardSubmitted
      // flag should stay false, not get set by a debug-mode play.
      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('memoria:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a debug-mode play should never mark leaderboardSubmitted true');

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
