'use strict';

// Covers the alias control and the leaderboard section on Memoria's
// reveal screen. Firebase isn't configured for these tests (no real
// project credentials belong in this repo - see firebase-config.js),
// so every check here exercises the client-side alias/UI logic and the
// graceful "Firebase unavailable" degradation path (submitLeaderboardScore/
// getTopLeaderboardScores in shared.js resolve/reject cleanly instead of
// throwing when firebase.apps is empty) - not real reads/writes against a
// live Firestore backend. Once a real Firebase project is wired up, do
// one manual smoke test against it (a real submission appearing in the
// Firebase console, and ?debug=true play NOT appearing there).
//
// Uses a saved-result-planted-in-localStorage trick (see
// memoria/index.html's loadSavedResult) to reach the reveal screen
// instantly instead of waiting out a real 60s round.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedResult(page, dateKey, score, matchedStations) {
  await page.evaluate(function (args) {
    localStorage.setItem('memoria:' + args.dateKey, JSON.stringify({
      score: args.score,
      won: args.score >= 8,
      matchedStations: args.matchedStations,
    }));
  }, { dateKey: dateKey, score: score, matchedStations: matchedStations });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('shows the alias input when none is saved, and saving it persists site-wide and updates the display', async () => {
    const DATE = '2026-11-01';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 3, ['Insurgentes', 'Zapata', 'Normal']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted saved result');

      // No alias saved yet - should show the input, not the display row.
      const inputVisible = await page.locator('#leaderboard-alias-row input').isVisible();
      assert.strictEqual(inputVisible, true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Eduardo');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(200);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Eduardo'), 'should show the saved alias, got: ' + displayText);
      assert.ok(displayText.includes('Cambiar'), 'should show a Cambiar button once an alias is set');

      // Site-wide key, not a Memoria-specific one - so a future leaderboard
      // on another game could reuse the same alias.
      const storedKey = await page.evaluate(() => localStorage.getItem('metrordle:alias'));
      assert.strictEqual(storedKey, 'Eduardo');

      // Clicking Cambiar should bring the input back, pre-filled.
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(100);
      const inputValue = await page.$eval('#leaderboard-alias-row input', (el) => el.value);
      assert.strictEqual(inputValue, 'Eduardo', 'Cambiar should pre-fill the input with the current alias');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('an already-saved alias shows the display row directly on load', async () => {
    const DATE = '2026-11-02';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Metrobot'));
      await plantSavedResult(page, DATE, 5, ['Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Metrobot'), 'should show the pre-existing alias without needing to type it again');
    } finally {
      await context.close();
    }
  });

  test('the leaderboard section degrades gracefully with no configured Firebase project', async () => {
    const DATE = '2026-11-03';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 2, ['Insurgentes', 'Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message to show');
      const statusText = await page.$eval('#leaderboard-status', (el) => el.textContent);
      assert.ok(statusText.length > 0, 'expected non-empty leaderboard status text');

      const rows = await page.$$('#leaderboard-list .leaderboard__row');
      assert.strictEqual(rows.length, 0, 'expected no leaderboard rows without a configured Firebase project');

      assert.strictEqual(errors.length, 0, 'Firebase SDK scripts + unconfigured firebase-config.js should never throw: ' + JSON.stringify(errors));
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
