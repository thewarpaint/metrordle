'use strict';

// Covers /admin/, the read-only cross-game leaderboard browser: the same
// prev/next date-nav each game's own ?debug=true mode uses (see
// index.html's #date-debug), but always on, plus one leaderboard section
// per game (metrordle-leaderboard, laberinto-leaderboard,
// memoria-leaderboard, metroguessr-leaderboard), each reusing that
// game's own collection/orderBySpecs/score-formatting - see
// admin/index.html's GAMES array - plus the shared streakCell() 🔥 x N
// badge (N > 1 only) every one of those four games' rows gets. Metro
// Crush's own section isn't covered here yet, and has no streak concept
// at all (see AGENTS.md).
//
// This sandboxed test environment can't reach Firestore at all
// (gstatic.com is unreachable), so the "real data" checks stub
// MetroShared.getTopLeaderboardScores() via a route-intercepted,
// patched shared.js (same trick used to produce the leaderboard
// screenshots during development) rather than exercising a real query -
// see tests/shared/leaderboard-query.test.js for coverage of that
// function's own real query-construction/extraFields logic instead.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

const SAMPLE_DATA = {
  'metrordle-leaderboard': [
    { id: 'fer', alias: 'Fer', attempts: 2, hardMode: true, streak: 5 },
    // streak: 1 ("played today" but not yet a streak worth calling
    // out) and no streak field at all (predates the field) should both
    // render nothing - see streakCell()'s own N > 1 threshold.
    { id: 'eduardo', alias: 'Eduardo', attempts: 2, hardMode: false, streak: 1 },
  ],
  'laberinto-leaderboard': [
    { id: 'karla', alias: 'Karla', stations: 9, transfers: 1 },
  ],
  'memoria-leaderboard': [
    { id: 'pao', alias: 'Pao', score: 7, streak: 0 },
  ],
  'metroguessr-leaderboard': [
    { id: 'oscar', alias: 'Oscar', attempts: 1, hardMode: true, streak: 12 },
  ],
};

async function stubLeaderboardData(page, dataByCollection) {
  await page.route('**/shared.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body + `
      (function () {
        var DATA = ${JSON.stringify(dataByCollection)};
        window.MetroShared.getTopLeaderboardScores = function (collectionName) {
          return Promise.resolve(DATA[collectionName] || []);
        };
      })();
    `;
    await route.fulfill({ response, body: patched });
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('shows the date picker (always on, unlike the games\' own ?debug=true-gated one) and degrades gracefully with no reachable Firebase', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/admin/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#date-debug').isVisible(), true, 'the date picker should be visible without ?debug=true');

      const labelText = await page.locator('#date-debug-label').textContent();
      assert.ok(/^\d{4}-\d{2}-\d{2}( \(hoy\))?$/.test(labelText), 'expected a YYYY-MM-DD date label, got: ' + labelText);
      assert.ok(labelText.endsWith('(hoy)'), 'the initial date should be today\'s, got: ' + labelText);

      for (const key of ['metrordle', 'laberinto', 'memoria']) {
        const statusVisible = await page.locator('#' + key + '-status').isVisible();
        assert.strictEqual(statusVisible, true, key + ' should show the empty-state message when Firebase is unreachable');
        const rowCount = await page.locator('#' + key + '-list .leaderboard__row').count();
        assert.strictEqual(rowCount, 0, key + ' should render no rows');
      }

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('the date picker moves across dates, and each game\'s deep link tracks the shown date', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/admin/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const initialLabel = await page.locator('#date-debug-label').textContent();
      const initialDateKey = initialLabel.replace(' (hoy)', '');

      await page.click('#date-prev');
      await page.waitForTimeout(200);
      const prevLabel = await page.locator('#date-debug-label').textContent();
      assert.notStrictEqual(prevLabel, initialLabel, 'the label should change after clicking the previous-day chevron');

      const prevDateKey = prevLabel.replace(' (hoy)', '');
      // Local date components throughout, not toISOString() (which
      // converts to UTC and could land on the wrong calendar day
      // depending on the test runner's timezone) - matches how the app
      // itself builds a date key (see shared.js's getDateKey()).
      const expectedPrev = new Date(initialDateKey + 'T00:00:00');
      expectedPrev.setDate(expectedPrev.getDate() - 1);
      const pad2 = (n) => String(n).padStart(2, '0');
      const expectedPrevKey = expectedPrev.getFullYear() + '-' + pad2(expectedPrev.getMonth() + 1) + '-' + pad2(expectedPrev.getDate());
      assert.strictEqual(prevDateKey, expectedPrevKey, 'expected the previous calendar day');

      const metrordleHref = await page.$eval('#metrordle-link', (el) => el.getAttribute('href'));
      assert.strictEqual(metrordleHref, '/?debug=true&date=' + prevDateKey, 'the deep link should point at the currently shown date');

      await page.click('#date-next');
      await page.waitForTimeout(200);
      const backLabel = await page.locator('#date-debug-label').textContent();
      assert.strictEqual(backLabel, initialLabel, 'clicking next should return to the original date');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('renders each game\'s sample leaderboard data with that game\'s own ranking and score formatting', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubLeaderboardData(page, SAMPLE_DATA);
      await page.goto(server.baseUrl + '/admin/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      // Metrordle: badge (left) + fixed-width number (right), per row -
      // see index.html's own leaderboard for the same two-slot layout.
      const metrordleRows = page.locator('#metrordle-list .leaderboard__row');
      assert.strictEqual(await metrordleRows.count(), 2);
      assert.strictEqual(await metrordleRows.nth(0).locator('.leaderboard__alias-name').textContent(), 'Fer');
      assert.strictEqual(await metrordleRows.nth(0).locator('.leaderboard__score-badge').textContent(), '🧠');
      assert.strictEqual(await metrordleRows.nth(0).locator('.leaderboard__score-number').textContent(), '2');
      assert.strictEqual(await metrordleRows.nth(0).locator('.leaderboard__streak').textContent(), '🔥 x 5', 'a streak of 5 (>1) should show');
      assert.strictEqual(await metrordleRows.nth(1).locator('.leaderboard__alias-name').textContent(), 'Eduardo');
      assert.strictEqual(await metrordleRows.nth(1).locator('.leaderboard__score-badge').textContent(), '');
      assert.strictEqual(await metrordleRows.nth(1).locator('.leaderboard__streak').textContent(), '', 'a streak of 1 (not > 1) should show nothing');

      // Laberinto: "stations-transfers" single cell. No streak field on
      // this one entry at all (predates the feature) - same nothing-
      // shown outcome as Eduardo's streak: 1 above.
      const laberintoScore = await page.$eval('#laberinto-list .leaderboard__score--plain', (el) => el.textContent);
      assert.strictEqual(laberintoScore, '9-1');
      const laberintoStreak = await page.$eval('#laberinto-list .leaderboard__streak', (el) => el.textContent);
      assert.strictEqual(laberintoStreak, '', 'a missing streak field should show nothing, not "undefined" or an error');

      // Memoria: plain score number. streak: 0 (a real, valid value -
      // Memoria submits on a loss too) is still not > 1, so nothing shows.
      const memoriaScore = await page.$eval('#memoria-list .leaderboard__score--plain', (el) => el.textContent);
      assert.strictEqual(memoriaScore, '7');
      const memoriaStreak = await page.$eval('#memoria-list .leaderboard__streak', (el) => el.textContent);
      assert.strictEqual(memoriaStreak, '', 'a streak of 0 should show nothing');

      // Metroguessr: same badge (left) + fixed-width number (right)
      // layout as Metrordle's, added once Metroguessr grew its own
      // normal/hard mode split.
      const metroguessrRows = page.locator('#metroguessr-list .leaderboard__row');
      assert.strictEqual(await metroguessrRows.count(), 1);
      assert.strictEqual(await metroguessrRows.nth(0).locator('.leaderboard__alias-name').textContent(), 'Oscar');
      assert.strictEqual(await metroguessrRows.nth(0).locator('.leaderboard__score-badge').textContent(), '🧠');
      assert.strictEqual(await metroguessrRows.nth(0).locator('.leaderboard__score-number').textContent(), '1');
      assert.strictEqual(await metroguessrRows.nth(0).locator('.leaderboard__streak').textContent(), '🔥 x 12', 'a double-digit streak should still render correctly');

      // No empty-state message should show once real entries render.
      for (const key of ['metrordle', 'laberinto', 'memoria']) {
        const statusVisible = await page.locator('#' + key + '-status').isVisible();
        assert.strictEqual(statusVisible, false, key + ' should hide the empty-state message once it has entries');
      }

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
