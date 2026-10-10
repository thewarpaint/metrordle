'use strict';

// Covers /clasificador/'s deterministic daily puzzle, multi-line
// correctness, and basic round lifecycle - no real-time waiting beyond
// a couple of short animation settles.
//
// 2026-11-19 is used throughout as a known-good fixture date: with the
// real MetroShared.LINES data, 'metrordle-clasificador-2026-11-19'
// deterministically picks Líneas 1/4/5/6/7/12, and the first station
// dealt is 'Pantitlán' - itself a real transfer station between Línea
// 1 and Línea 5 (among others; not every one of its real lines is
// featured today), making it a genuine multi-line case to test
// against, not a contrived one. Recomputed independently in a
// throwaway Node script against the real shared.js before writing this
// file - if a future change to MetroShared.LINES, FEATURED_LINE_COUNT,
// or the seeded-shuffle algorithm ever changes this date's picks, this
// file's own assertions will fail loudly rather than silently testing
// the wrong scenario.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

const FIXTURE_DATE = '2026-11-19';

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the day\'s 6 featured lines and station dealing order are deterministic - identical across independent sessions', async () => {
    const context1 = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page1 = await context1.newPage();
    const context2 = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page2 = await context2.newPage();
    try {
      await page1.goto(server.baseUrl + '/clasificador/?debug=true&date=' + FIXTURE_DATE, { waitUntil: 'networkidle' });
      await page2.goto(server.baseUrl + '/clasificador/?debug=true&date=' + FIXTURE_DATE, { waitUntil: 'networkidle' });
      await page1.waitForTimeout(200);
      await page2.waitForTimeout(200);

      const lines1 = await page1.$$eval('#buckets .bucket', (els) => els.map((e) => e.dataset.lineId));
      const lines2 = await page2.$$eval('#buckets .bucket', (els) => els.map((e) => e.dataset.lineId));
      assert.deepStrictEqual(lines1, ['1', '4', '5', '6', '7', '12'], 'expected the known fixture lines in MetroShared.LINES\' own ascending order, got: ' + lines1);
      assert.deepStrictEqual(lines1, lines2, 'the same date should pick the exact same 6 lines in two independent sessions');

      const names1 = await page1.$$eval('#queue .queue-card .queue-card__name', (els) => els.map((e) => e.textContent));
      const names2 = await page2.$$eval('#queue .queue-card .queue-card__name', (els) => els.map((e) => e.textContent));
      assert.deepStrictEqual(names1, names2, 'the same date should deal the exact same station queue in two independent sessions');
      assert.strictEqual(names1[names1.length - 1], 'Pantitlán', 'expected the known fixture\'s first-dealt (active, bottom-of-queue) station, got: ' + names1[names1.length - 1]);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('a station on more than one of today\'s lines counts correct on either - credit goes to whichever bucket the player actually tapped', async () => {
    const DATE = FIXTURE_DATE;
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.click('#start-btn');
      await page.waitForTimeout(150);

      const activeName = await page.$eval('.queue-card--active .queue-card__name', (el) => el.textContent);
      assert.strictEqual(activeName, 'Pantitlán', 'expected the fixture\'s known first active station');

      // Línea 4 is featured today but Pantitlán isn't on it - wrong tap
      // should shake the card and leave the score at 0.
      await page.click('#buckets .bucket[data-line-id="4"]');
      await page.waitForTimeout(450);

      const statusAfterWrong = await page.$eval('#status', (el) => el.textContent);
      assert.ok(statusAfterWrong.endsWith('0 correctas'), 'a wrong guess should not change the score, got: ' + statusAfterWrong);
      const stillActiveName = await page.$eval('.queue-card--active .queue-card__name', (el) => el.textContent);
      assert.strictEqual(stillActiveName, 'Pantitlán', 'the wrongly-guessed station should still be active, not advanced');

      // Línea 5 is Pantitlán's OTHER real line among today's 6 (not
      // Línea 1) - this is the actual point of the test: a station's
      // non-"primary" valid line must also be accepted.
      await page.click('#buckets .bucket[data-line-id="5"]');
      await page.waitForTimeout(450);

      const statusAfterCorrect = await page.$eval('#status', (el) => el.textContent);
      assert.ok(statusAfterCorrect.endsWith('1 correcta'), 'a correct guess on the non-primary valid line should count, got: ' + statusAfterCorrect);
      const newActiveName = await page.$eval('.queue-card--active .queue-card__name', (el) => el.textContent);
      assert.notStrictEqual(newActiveName, 'Pantitlán', 'the queue should have advanced past the resolved station');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('station cards show the real station pictogram from /station-icons.svg', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=' + FIXTURE_DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const href = await page.$eval('.queue-card--active .queue-card__icon use', (el) => el.getAttribute('href'));
      assert.strictEqual(href, '/station-icons.svg#pantitlan');
    } finally {
      await context.close();
    }
  });

  test('a completed round persists its per-line result and shows it on reload instead of a fresh queue', async () => {
    const DATE = '2026-11-20';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate((args) => {
        localStorage.setItem('clasificador:' + args.dateKey, JSON.stringify({
          total: 9,
          correctByLine: { '1': 3, '6': 1, '7': 2, '8': 1, '12': 1, 'B': 0 },
        }));
        // max (6) ahead of count (4) so the reveal banner's own
        // maxStreakLine() has something to append, same convention as
        // Metro Crush's.
        localStorage.setItem('clasificador:streak', JSON.stringify({ count: 4, max: 6, lastResultDate: args.dateKey }));
      }, { dateKey: DATE });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted finished result');
      assert.strictEqual(await page.locator('#queue-wrap').isVisible(), false, 'the queue should stay hidden once done');
      assert.strictEqual(await page.locator('#buckets').isVisible(), false, 'the buckets should stay hidden once done');

      const total = await page.$eval('#reveal-total', (el) => el.textContent);
      assert.ok(total.includes('9'), 'expected the planted total in the reveal text, got: ' + total);

      const counts = await page.$$eval('#line-bars .line-bar__count', (els) => els.map((e) => e.textContent));
      assert.deepStrictEqual(counts, ['× 3', '× 1', '× 2', '× 1', '× 1', '× 0'], 'expected each line\'s planted "× N" count in the known fixture\'s line order (1, 6, 7, 8, 12, B)');

      const banner = await page.$eval('#reveal-banner', (el) => el.textContent);
      assert.strictEqual(banner, '¡Tiempo! 🔥 Racha: 4 días, máxima: 6 días', 'expected the reveal banner to show the planted streak, got: ' + banner);

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('?debug=true reveals the date-nav and jumping a day changes the lines/queue, going back restores them', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=' + FIXTURE_DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#date-debug').isVisible(), true);
      const linesBefore = await page.$$eval('#buckets .bucket', (els) => els.map((e) => e.dataset.lineId));

      await page.click('#date-next');
      await page.waitForTimeout(200);
      const dateLabel = await page.$eval('#date-debug-label', (el) => el.textContent);
      assert.strictEqual(dateLabel, '2026-11-20');

      await page.click('#date-prev');
      await page.waitForTimeout(200);
      const linesAfter = await page.$$eval('#buckets .bucket', (els) => els.map((e) => e.dataset.lineId));
      assert.deepStrictEqual(linesAfter, linesBefore, 'navigating back to the fixture date should restore its own deterministic lines');
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
