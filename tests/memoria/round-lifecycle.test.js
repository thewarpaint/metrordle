'use strict';

// Slower checks that let a round's 60-second timer run out for real.
// Takes roughly a minute to run - see ../README.md.
//
// Covers: reloading mid-round restarts today's puzzle instead of
// resuming a stale countdown; a round that runs to completion persists
// the right score/streak, shows the correct reveal and rating, and
// copies the expected share text; reloading after a saved result shows
// that same result instead of a fresh board.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { clickCardForStation } = require('../lib/memoria-helpers');

async function matchSpecificPair(page, station) {
  await clickCardForStation(page, station);
  await page.waitForTimeout(60);
  await clickCardForStation(page, station);
}

// Must match START_DATE_KEY in memoria/index.html.
const START_DATE_KEY = '2026-08-29';

function gameNumberFor(dateKey) {
  var start = new Date(START_DATE_KEY + 'T00:00:00');
  var target = new Date(dateKey + 'T00:00:00');
  var msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - start.getTime()) / msPerDay) + 1;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('reloading mid-round restarts today\'s puzzle with a fresh 60s clock', async () => {
    const DATE = '2026-10-01';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.click('#start-btn');
      await page.waitForTimeout(1200);

      const statusBeforeReload = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(statusBeforeReload, '59s · 0 parejas');

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#start-overlay').isVisible(), true, 'the start dialog should reappear, not a resumed round');
      const statusAfterReload = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(statusAfterReload, '60s · 0 parejas', 'reload should reset to the full round length, not carry over the countdown');
    } finally {
      await context.close();
    }
  });

  test('a completed round persists its result and shows the right reveal, rating, and share text', async () => {
    const DATE = '2026-10-02';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.click('#start-btn');
      await page.waitForTimeout(200);

      // Match 3 specific stations from the initial board (known for this
      // date), deliberately in an order that is NOT already grouped by
      // line - Línea 12, then Línea 2, then Línea 1 - so the reveal
      // screen's line-sorted icon order can only match by actually
      // re-sorting, not by coincidentally mirroring match order.
      const station1 = 'San Andrés Tomatlán'; // Línea 12
      const station2 = 'Normal'; // Línea 2
      const station3 = 'Candelaria'; // Línea 1
      await matchSpecificPair(page, station1);
      await page.waitForTimeout(500);
      await matchSpecificPair(page, station2);
      await page.waitForTimeout(500);
      await matchSpecificPair(page, station3);
      await page.waitForTimeout(500);

      const midStatus = await page.$eval('#status', (el) => el.textContent);
      assert.ok(midStatus.endsWith('3 parejas'), 'should show 3 parejas after matching three times, got: ' + midStatus);

      // Let the round run out for real - poll rather than sleep a fixed
      // 60s, since the exact remaining time depends on how long the
      // matches above took to click through.
      await page.locator('#reveal').waitFor({ state: 'visible', timeout: 65000 });

      const banner = await page.$eval('#reveal-banner', (el) => el.textContent);
      assert.strictEqual(banner, 'Se acabó el tiempo 🔥 Racha: 0 días');

      const stat = await page.$eval('#stat-you', (el) => el.textContent);
      assert.strictEqual(stat, 'Parejas: 3');

      // Persisted matchedStations stays in MATCH order - only the reveal's
      // rendered order is sorted by line, not the stored data itself.
      const saved = await page.evaluate((k) => localStorage.getItem('memoria:' + k), DATE);
      assert.deepStrictEqual(JSON.parse(saved), { score: 3, won: false, matchedStations: [station1, station2, station3] });

      // The reveal screen should show one small icon per matched station,
      // laid out 6 per row, grouped by line rather than match order -
      // Línea 1 (Candelaria), then Línea 2 (Normal), then Línea 12 (San
      // Andrés Tomatlán), reordered from the Línea 12/2/1 match order above.
      const iconCells = await page.$$('#reveal-icons .reveal__icon-cell');
      assert.strictEqual(iconCells.length, 3, 'expected one icon per matched pair');
      const iconLabels = await page.$$eval('#reveal-icons .reveal__icon-cell', (els) => els.map((e) => e.getAttribute('aria-label')));
      assert.deepStrictEqual(iconLabels, [station3, station2, station1], 'icons should be grouped by line, not shown in match order');
      const columnCount = await page.$eval('#reveal-icons', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.strictEqual(columnCount, 6, 'expected the icon grid to lay out 6 per row');

      await page.click('#share-btn');
      await page.waitForTimeout(300);
      const shareText = await page.evaluate(() => navigator.clipboard.readText());

      const expected = 'Metrordle: Memoria #' + gameNumberFor(DATE) + '\n' +
        '🟧 Calificación: Mala\n' +
        'Parejas: 3\n' +
        '🔥 Racha: 0 días\n\n' +
        'https://metrordle.com/memoria/';
      assert.strictEqual(shareText, expected);

      // Reload after finishing: should show the SAME saved result, not
      // a fresh board.
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show immediately on reload after finishing');
      const statAfterReload = await page.$eval('#stat-you', (el) => el.textContent);
      assert.strictEqual(statAfterReload, 'Parejas: 3', 'reload should show the same saved score, not start a new round');
      const iconLabelsAfterReload = await page.$$eval('#reveal-icons .reveal__icon-cell', (els) => els.map((e) => e.getAttribute('aria-label')));
      assert.deepStrictEqual(iconLabelsAfterReload, [station3, station2, station1], 'reload should show the same line-sorted icon order');
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
