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
      // ?debug=true deliberately skips the inline start overlay (it calls
      // startNewGame() on every date-nav click, and showing the mode
      // picker for each fake "fresh day" would make date-browsing
      // unusable) - it starts straight into 'normal' mode instead, so the
      // overlay stays hidden here.
      await page.goto(server.baseUrl + '/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      assert.strictEqual(await page.locator('#start-overlay').isVisible(), false, 'expected no start overlay under ?debug=true');

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

  test('a fresh day shows the inline start overlay (not a modal); picking a mode starts the round and reveals the board', async () => {
    // No ?debug=true, so this is a real fresh day: the board renders
    // behind the opaque .start-overlay, and the player picks the mode
    // inline there - the same flow Metro Crush uses, replacing the old
    // full-screen .mode-modal.
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/?date=2026-12-31', { waitUntil: 'networkidle' });

      assert.strictEqual(await page.locator('#start-overlay').isVisible(), true, 'expected the inline start overlay on a fresh day');
      // The common chrome renders behind the overlay before any mode is
      // picked - the page must not be broken while state.mode is null.
      const lineId = await page.$eval('#line-badge-id', (el) => el.textContent);
      assert.ok(lineId.length > 0, 'expected the line badge to render before a mode is chosen');
      assert.strictEqual(await page.locator('#check-btn').isEnabled(), false, 'expected the check button disabled until a mode is chosen');

      await page.click('#start-normal-btn');

      assert.strictEqual(await page.locator('#start-overlay').isVisible(), false, 'expected the overlay to close after picking a mode');
      assert.strictEqual(await page.locator('#check-btn').isEnabled(), true, 'expected the check button enabled once the round starts');
      assert.strictEqual(await page.locator('#platform .platform__row').count(), 5, 'expected the 5 normal-mode station rows once started');

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
