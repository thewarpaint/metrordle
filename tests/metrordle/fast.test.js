'use strict';

// Covers Metrordle's own core page chrome that isn't already exercised
// by metrordle/leaderboard.test.js (which stays scoped to the
// leaderboard section itself). For now just the line-of-the-day badge.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the line-of-the-day badge reads "Línea <id>", not the old .roundel\'s literal "STC" caption', async () => {
    const DATE = '2026-12-30';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      // ?debug=true deliberately skips the mode modal (it calls
      // startNewGame() on every date-nav click, and popping the modal for
      // each fake "fresh day" would make date-browsing unusable) - it
      // starts straight into 'normal' mode instead, so there's no modal
      // to dismiss here.
      await page.goto(server.baseUrl + '/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      assert.strictEqual(await page.locator('#mode-modal').isVisible(), false, 'expected no mode modal under ?debug=true');

      // shared.css's own .line-badge, promoted from this exact element -
      // see its own comment there.
      const lineBadgeLabel = await page.$eval('#line-badge .line-badge__label', (el) => el.textContent);
      assert.strictEqual(lineBadgeLabel, 'Línea');
      const lineBadgeId = await page.$eval('#line-badge-id', (el) => el.textContent);
      assert.ok(lineBadgeId.length > 0, 'expected a non-empty line id in the badge');
      const bodyText = await page.$eval('body', (el) => el.textContent);
      assert.ok(!bodyText.includes('STC'), 'the old literal "STC" caption should be gone');

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
