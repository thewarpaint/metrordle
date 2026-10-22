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
    // countTransfers() only looks at index >= 2 onward. Real line ids
    // ('1'/'2'), not made-up ones - the breadcrumb now renders a real
    // makeRouteDot(lineId) per hop, which needs a line this page's own
    // getLineById() can actually resolve.
    var path = [{ station: 'Origen', lineId: null }];
    for (var i = 1; i <= args.stations; i++) {
      var lineId = (args.transfers > 0 && i === args.stations) ? '2' : '1';
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

      // Saving an alias now hides the row entirely instead of showing a
      // "Jugando como" display - the player's own highlighted leaderboard
      // row identifies them.
      assert.strictEqual(await page.locator('#leaderboard-alias-row').isVisible(), false, 'the alias row should hide after saving an alias');

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
          path: [{ station: 'Origen', lineId: null }, { station: 'Estacion1', lineId: '1' }],
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

  test('shows a 🔥 × N streak badge per row (N > 1 only), fed by getTopLeaderboardScores() extraFields', async () => {
    const DATE = '2026-12-23';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
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
              { id: 'ana', alias: 'Ana', stations: 6, transfers: 0, streak: 5 },
              // A streak of 1 ("played today" but not yet a streak worth
              // calling out) and no streak field at all (predates the
              // field) should both render nothing.
              { id: 'beto', alias: 'Beto', stations: 7, transfers: 0, streak: 1 },
              { id: 'caro', alias: 'Caro', stations: 8, transfers: 1 },
            ];
            window.MetroShared.getTopLeaderboardScores = function () {
              return Promise.resolve(DATA);
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/laberinto/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantWonState(page, DATE, 8, 1, true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#leaderboard-list .leaderboard__row');
      assert.strictEqual(await rows.count(), 3);

      const streaks = await rows.locator('.leaderboard__streak').allTextContents();
      assert.deepStrictEqual(streaks, ['🔥 × 5', '', ''], 'only a streak > 1 should render, everything else should show nothing');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('from the scoring cutover on, the leaderboard ranks by stations+transfers and shows "NN+MM"; earlier days keep "NN-MM" and no notice', async () => {
    async function check(dateKey, expectSum) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.route('**/shared.js', async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          // Capture the ranking spec the page asks for, and feed back one
          // entry carrying both the sum `score` and its stations/transfers
          // breakdown so either scoring mode has what it renders.
          const patched = body + `
            (function () {
              window.__orderBy = null; window.__extra = null;
              window.MetroShared.getTopLeaderboardScores = function (col, dk, n, orderBySpecs, opts) {
                window.__orderBy = orderBySpecs; window.__extra = (opts && opts.extraFields) || [];
                return Promise.resolve([{ id: 'ana', alias: 'Ana', stations: 15, transfers: 3, score: 18, streak: 4 }]);
              };
            })();`;
          await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
        });
        await page.goto(server.baseUrl + '/laberinto/?debug=true&date=' + dateKey, { waitUntil: 'networkidle' });
        await plantWonState(page, dateKey, 15, 3, true);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const scoreText = await page.locator('#leaderboard-list .leaderboard__row .leaderboard__score--plain').first().textContent();
        const orderBy = await page.evaluate(() => window.__orderBy);
        const extra = await page.evaluate(() => window.__extra);
        const noticeVisible = await page.evaluate(() => { const nn = document.getElementById('scoring-notice'); return !!nn && !nn.hidden; });

        if (expectSum) {
          assert.strictEqual(scoreText, '15+3', dateKey + ': expected the "15+3" sum display');
          assert.deepStrictEqual(orderBy, [['score', 'asc']], dateKey + ': expected ranking by the stations+transfers sum');
          assert.ok(extra.indexOf('stations') !== -1 && extra.indexOf('transfers') !== -1, dateKey + ': stations/transfers must come via extraFields to render "15+3"');
          assert.strictEqual(noticeVisible, true, dateKey + ': expected the scoring info notice');
        } else {
          assert.strictEqual(scoreText, '15-3', dateKey + ': expected the old "15-3" display');
          assert.deepStrictEqual(orderBy, [['stations', 'asc'], ['transfers', 'asc']], dateKey + ': expected the old stops-then-transfers ranking');
          assert.strictEqual(noticeVisible, false, dateKey + ': there should be no scoring notice before the cutover');
        }
        assert.strictEqual(errors.length, 0, dateKey + ': no page errors: ' + JSON.stringify(errors));
      } finally {
        await context.close();
      }
    }

    await check('2026-10-22', false); // day before the cutover
    await check('2026-10-23', true);  // cutover day
  });

  test('the scoring notice has a × that dismisses it for good (persisted, never shown again)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const url = server.baseUrl + '/laberinto/?debug=true&date=2026-10-23';
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.locator('#scoring-notice').isVisible(), true, 'the notice should show on a cutover day');
      assert.strictEqual(await page.locator('#scoring-notice .notice__close').count(), 1, 'the notice should have a × close button');

      await page.click('#scoring-notice .notice__close');
      await page.waitForTimeout(100);
      assert.strictEqual(await page.locator('#scoring-notice').isVisible(), false, 'clicking × should hide the notice');
      const flag = await page.evaluate(() => localStorage.getItem('laberinto:scoring-notice-dismissed'));
      assert.strictEqual(flag, '1', 'dismissal should be persisted');

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.locator('#scoring-notice').isVisible(), false, 'a dismissed notice should stay hidden after reload');

      assert.strictEqual(errors.length, 0, 'no page errors: ' + JSON.stringify(errors));
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
