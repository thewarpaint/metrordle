'use strict';

// Covers the leaderboard feature on /laberinto/ (its own
// 'laberinto-leaderboard' Firestore collection, no localStorage
// fallback - see shared.js's submitLeaderboardScore/getTopLeaderboardScores).
// Ranked the opposite direction from Memoria's: fewer stations wins,
// fewer transfers breaks a tie, both ascending. This sandboxed test
// environment can't reach Firestore at all (gstatic.com is unreachable),
// which is itself a useful case to cover: the leaderboard section must
// still render (an empty-state message, not an error) and the page must
// not throw, exactly like a real player whose network blocks Firebase.
//
// Uses a fabricated-path-planted-in-localStorage trick (see
// tests/memoria/leaderboard.test.js's saved-result equivalent) to reach
// the reveal screen instantly instead of actually solving the daily
// puzzle - loadSavedState() only checks that `path` is a non-empty
// array, so the exact stations don't need to be real or reach the
// day's actual destination for a game already marked 'won'.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantWonState(page, dateKey, stations, transfers, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    // A path with `args.stations` hops and a line change on the final
    // hop only if args.transfers > 0 - countStops() = path.length - 1,
    // countTransfers() only looks at index >= 2 onward.
    var path = [{ station: 'Origen', lineId: null }];
    for (var i = 1; i <= args.stations; i++) {
      var lineId = (args.transfers > 0 && i === args.stations) ? 'line-b' : 'line-a';
      path.push({ station: 'Estacion' + i, lineId: lineId });
    }
    localStorage.setItem('laberinto:' + args.dateKey, JSON.stringify({
      path: path,
      status: 'won',
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, stations: stations, transfers: transfers, leaderboardSubmitted: leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders above the optimal-route details and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2026-12-20';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/laberinto/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantWonState(page, DATE, 8, 1, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted won state');

      const titleText = await page.$eval('.leaderboard__title', (el) => el.textContent);
      assert.strictEqual(titleText, 'Mejores 5 rutas hoy');

      const order = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#leaderboard, #optimal-path-list'));
        return nodes.map((n) => n.id);
      });
      assert.deepStrictEqual(order, ['leaderboard', 'optimal-path-list'], 'leaderboard should come before the optimal-route details in the DOM');

      // No Firestore reachable in this sandbox and no local fallback on
      // this page - getTopLeaderboardScores() resolves to [] rather than
      // throwing, so this should render the empty-state message instead
      // of an error.
      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message when Firebase is unreachable');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('saving an alias persists it site-wide without a page error, even under ?debug=true', async () => {
    const DATE = '2026-12-21';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/laberinto/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantWonState(page, DATE, 7, 0, false);
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
      // laberinto/index.html) - the saved state's leaderboardSubmitted
      // flag should stay false, not get set by a debug-mode play.
      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('laberinto:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a debug-mode play should never mark leaderboardSubmitted true');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a give-up never has anything to submit, but still shows the leaderboard section without error', async () => {
    const DATE = '2026-12-22';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/laberinto/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Eduardo'));
      await page.evaluate((d) => {
        localStorage.setItem('laberinto:' + d, JSON.stringify({
          path: [{ station: 'Origen', lineId: null }, { station: 'Estacion1', lineId: 'line-a' }],
          status: 'gaveup',
          leaderboardSubmitted: false,
        }));
      }, DATE);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#leaderboard').isVisible(), true, 'the leaderboard section should still show on a give-up');

      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('laberinto:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a give-up should never mark leaderboardSubmitted true - there is no route to rank');

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
