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

  test('renders the Líneas, Estaciones, and Listas de estaciones galleries with one example row per pattern, no page errors', async () => {
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
      assert.strictEqual(stationExamples, 4, 'expected 4 station-display examples (node, card, badge, plain text)');

      const stationListExamples = await page.locator('#station-lists-gallery .design-example').count();
      assert.strictEqual(stationListExamples, 2, 'expected 2 station-list examples (platform, queue)');

      // One badge/circle/dot/card/row per sampled line or station -
      // confirms the galleries actually rendered real entries, not
      // empty rows. The first "Líneas" example is the one already-
      // consolidated pattern (shared.css's own real .line-badge, not a
      // .design- prefixed stand-in - see shared.css's own comment on it).
      const lineBadges = await page.locator('#lines-gallery .design-example').nth(0).locator('.line-badge').count();
      assert.strictEqual(lineBadges, 5, 'expected one .line-badge per sampled line');

      const stationCards = await page.locator('#stations-gallery .design-example').nth(1).locator('.design-station-card').count();
      assert.strictEqual(stationCards, 4, 'expected one station card per sampled station');

      const platformRows = await page.locator('#station-lists-gallery .design-example').nth(0).locator('.design-platform__row').count();
      assert.strictEqual(platformRows, 5, 'expected 5 platform rows (the puzzle\'s own station count)');

      const queueCards = await page.locator('#station-lists-gallery .design-example').nth(1).locator('.design-queue-card').count();
      assert.strictEqual(queueCards, 4, 'expected one queue card per sampled station');

      const activeQueueCards = await page.locator('#station-lists-gallery .design-example').nth(1).locator('.design-queue-card--active').count();
      assert.strictEqual(activeQueueCards, 1, 'expected exactly one queue card marked active');

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
