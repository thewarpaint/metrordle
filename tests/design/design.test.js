'use strict';

// Covers /design/, the visual-language reference page (see AGENTS.md's
// own bullet for it) - not a game, so there's no round/leaderboard
// lifecycle to exercise here. Deliberately light: this page's exact
// shape is expected to keep changing as the actual consolidation work
// happens, so this just locks in that it renders without error and
// that each gallery produces the example count its own script expects,
// rather than asserting on anything about the patterns' final look.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('renders the Líneas, Estaciones, Listas de estaciones, and Avisos galleries with one example row per pattern, no page errors', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 1200 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/design/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const lineExamples = await page.locator('#lines-gallery .design-example').count();
      assert.strictEqual(lineExamples, 4, 'expected 4 line-indicator examples (line-badge, compact, circle, dot)');

      const stationExamples = await page.locator('#stations-gallery .design-example').count();
      assert.strictEqual(stationExamples, 6, 'expected 6 station-display examples (node, card, badge, chip, plain text, reveal grid)');

      const stationListExamples = await page.locator('#station-lists-gallery .design-example').count();
      assert.strictEqual(stationListExamples, 6, 'expected 6 station-list examples (platform, platform hard mode, platform as .station-card, queue, breadcrumb, optimal path)');

      // One badge/circle/dot/card/row per sampled line or station -
      // confirms the galleries actually rendered real entries, not
      // empty rows. The first and fourth "Líneas" examples are
      // already-consolidated patterns (shared.css's own real
      // .line-badge/.route-dot, not .design- prefixed stand-ins - see
      // shared.css's own comments on them).
      const lineBadges = await page.locator('#lines-gallery .design-example').nth(0).locator('.line-badge').count();
      assert.strictEqual(lineBadges, 5, 'expected one .line-badge per sampled line');

      const lineDots = await page.locator('#lines-gallery .design-example').nth(3).locator('.route-dot').count();
      assert.strictEqual(lineDots, 5, 'expected one .route-dot per sampled line');

      // The second, third, and fourth "Estaciones" examples are the other
      // already-consolidated patterns (shared.css's own real
      // .station-card/.station/.station--chip, not .design- prefixed
      // stand-ins - see shared.css's own comments on them).
      const stationCards = await page.locator('#stations-gallery .design-example').nth(1).locator('.station-card').count();
      assert.strictEqual(stationCards, 4, 'expected one station card per sampled station');

      const stationBadges = await page.locator('#stations-gallery .design-example').nth(2).locator('.station').count();
      assert.strictEqual(stationBadges, 4, 'expected one .station badge per sampled station');

      const stationChips = await page.locator('#stations-gallery .design-example').nth(3).locator('.station--chip').count();
      assert.strictEqual(stationChips, 4, 'expected one .station--chip per sampled station');

      const revealGridCells = await page.locator('#stations-gallery .design-example').nth(5).locator('.station').count();
      assert.strictEqual(revealGridCells, 18, 'expected 18 reveal-grid cells, mimicking the real end-of-round grid\'s own size');

      const platformRows = await page.locator('#station-lists-gallery .design-example').nth(0).locator('.design-platform__row').count();
      assert.strictEqual(platformRows, 5, 'expected 5 platform rows (the puzzle\'s own station count)');

      const platformHardCols = await page.locator('#station-lists-gallery .design-example').nth(1).locator('.design-platform-hard__col').count();
      assert.strictEqual(platformHardCols, 5, 'expected one hard-mode column per sampled station');
      const platformHardNames = await page.locator('#station-lists-gallery .design-example').nth(1).locator('.design-platform__name').count();
      assert.strictEqual(platformHardNames, 0, 'hard mode should show no station name at all');

      const platformCardCols = await page.locator('#station-lists-gallery .design-example').nth(2).locator('.station-card').count();
      assert.strictEqual(platformCardCols, 5, 'expected one .station-card per sampled station');
      const platformCardNames = await page.locator('#station-lists-gallery .design-example').nth(2).locator('.station-card__name').count();
      assert.strictEqual(platformCardNames, 0, 'this exploration should drop the name, same as the hard-mode example above');

      const queueCards = await page.locator('#station-lists-gallery .design-example').nth(3).locator('.design-queue-card').count();
      assert.strictEqual(queueCards, 4, 'expected one queue card per sampled station');

      const activeQueueCards = await page.locator('#station-lists-gallery .design-example').nth(3).locator('.design-queue-card--active').count();
      assert.strictEqual(activeQueueCards, 1, 'expected exactly one queue card marked active');

      const breadcrumbStops = await page.locator('#station-lists-gallery .design-example').nth(4).locator('.design-breadcrumb__stop').count();
      assert.strictEqual(breadcrumbStops, 11, 'expected one breadcrumb stop per sampled hop, same route as the optimal-path example below');
      const currentBreadcrumbStops = await page.locator('#station-lists-gallery .design-example').nth(4).locator('.design-breadcrumb__stop--current').count();
      assert.strictEqual(currentBreadcrumbStops, 1, 'expected exactly one breadcrumb stop marked current');
      const breadcrumbDots = await page.locator('#station-lists-gallery .design-example').nth(4).locator('.design-breadcrumb__stop-group .route-dot').count();
      assert.strictEqual(breadcrumbDots, 11, 'expected one line dot per breadcrumb stop');
      const mutedBreadcrumbDots = await page.locator('#station-lists-gallery .design-example').nth(4).locator('.route-dot--muted').count();
      assert.strictEqual(mutedBreadcrumbDots, 0, 'the origin should borrow the next hop\'s own line color rather than going muted');

      const optimalPathRows = await page.locator('#station-lists-gallery .design-example').nth(5).locator('.design-optimal-path__row').count();
      assert.strictEqual(optimalPathRows, 11, 'expected one optimal-path row per sampled hop, long enough to show a 2-digit step number');
      const mutedDots = await page.locator('#station-lists-gallery .design-example').nth(5).locator('.route-dot--muted').count();
      assert.strictEqual(mutedDots, 0, 'the origin should borrow the next hop\'s own line color rather than going muted');

      const noticeExamples = await page.locator('#notices-gallery .design-example').count();
      assert.strictEqual(noticeExamples, 5, 'expected 5 notice examples (win card, lose card, flat card, inline text, status-bar text)');

      const winText = await page.locator('#notices-gallery .design-notice--win').textContent();
      assert.ok(winText.indexOf('Racha: 6 días') !== -1, 'expected the win notice to include a streak: ' + winText);
      assert.ok(winText.indexOf('máxima: 9 días') !== -1, 'expected the win notice to include a max-streak mention: ' + winText);

      const loseText = await page.locator('#notices-gallery .design-notice--lose').textContent();
      assert.ok(loseText.indexOf('Racha: 0 días') !== -1, 'a loss should show the now-reset streak, not the pre-reset one: ' + loseText);

      const inlineBanner = await page.locator('#notices-gallery .design-notice-line__banner').textContent();
      const inlineStation = await page.locator('#notices-gallery .design-notice-line__station').textContent();
      assert.ok(inlineBanner.indexOf('Racha') !== -1, 'expected Metroguessr\'s inline banner to include a streak: ' + inlineBanner);
      assert.strictEqual(inlineStation, 'La estación era: Zócalo');

      const statusText = await page.locator('#notices-gallery .design-notice-status').textContent();
      assert.strictEqual(statusText.indexOf('Racha') !== -1, false, 'the status-bar notice reports attempts, not a streak: ' + statusText);

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
