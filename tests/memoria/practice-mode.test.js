'use strict';

// Covers the "Seguir jugando sin guardar" button on Memoria's reveal
// screen (continuePractice()/endPractice() in memoria/index.html) - lets
// a player keep matching pairs after a round ends without ever touching
// the already-persisted/submitted result. Planting a finished result
// directly in localStorage and reloading (same trick leaderboard.test.js
// uses) is the fast way to reach the reveal screen; a reload also means
// state.cells starts empty (startNewGame()'s saved-result branch), which
// is exactly the case continuePractice() has to deal a fresh board for.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { matchOnePair } = require('../lib/memoria-helpers');

async function plantSavedResult(page, dateKey, score, matchedStations, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    localStorage.setItem('memoria:' + args.dateKey, JSON.stringify({
      score: args.score,
      won: args.score >= 8,
      matchedStations: args.matchedStations,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, score: score, matchedStations: matchedStations, leaderboardSubmitted: leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('"Seguir jugando sin guardar" deals a fresh board and lets the player keep matching, without changing the saved result', async () => {
    const DATE = '2026-12-10';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 3, ['Insurgentes', 'Zapata', 'Hidalgo'], true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted finished result');

      await page.click('#practice-btn');
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#reveal').isVisible(), false, 'reveal should hide once practicing');
      assert.strictEqual(await page.locator('#memo-board').isVisible(), true, 'the board should be visible again');
      assert.strictEqual(await page.locator('#practice-banner').isVisible(), true, 'the practice banner should explain nothing is being saved');
      assert.strictEqual(await page.locator('#timer-track').isVisible(), false, 'no countdown should run during practice');

      const cardCount = await page.locator('#memo-board .memo-card:not(.memo-card--empty)').count();
      assert.strictEqual(cardCount, 16, 'a fresh practice board should deal a full 16-card grid, since the finished day never had one saved');

      const statusBeforeMatch = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(statusBeforeMatch, '3 parejas', 'practice status should show the pair count with no countdown prefix');

      const matched = await matchOnePair(page);
      assert.ok(matched, 'expected a matchable pair on the fresh practice board');
      await page.waitForTimeout(250);

      const statusAfterMatch = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(statusAfterMatch, '4 parejas', 'a practice match should still increment the on-screen pair count');

      // The whole point: nothing from practice play should ever reach
      // localStorage - the real submitted result stays exactly as planted.
      const stored = await page.evaluate((k) => localStorage.getItem('memoria:' + k), DATE);
      assert.deepStrictEqual(JSON.parse(stored), { score: 3, won: false, matchedStations: ['Insurgentes', 'Zapata', 'Hidalgo'], leaderboardSubmitted: true });

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('"Volver al resultado" restores the exact submitted score/matches, discarding whatever happened during practice', async () => {
    const DATE = '2026-12-11';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 5, ['Insurgentes', 'Zapata', 'Hidalgo', 'Balderas', 'Sevilla'], true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      await page.click('#practice-btn');
      await page.waitForTimeout(200);
      await matchOnePair(page);
      await page.waitForTimeout(250);

      const statusDuringPractice = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(statusDuringPractice, '6 parejas', 'the practice match should have bumped the live count up from 5');

      await page.click('#end-practice-btn');
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'should land back on the reveal screen');
      assert.strictEqual(await page.locator('#memo-board').isVisible(), false, 'the board should hide again');
      // #status-bar sits above the reveal banner and is never re-rendered
      // while 'done' (renderStatus() only runs for 'ready'/'playing'/
      // 'practice') - it must hide here, or it'd still show the stale
      // practice count ("6 parejas") right above the reveal's own,
      // correct "Parejas: 5", reading as two contradicting scores.
      assert.strictEqual(await page.locator('#status-bar').isVisible(), false, 'the status bar should hide behind the reveal screen, not show a stale practice count');
      const stat = await page.$eval('#stat-you', (el) => el.textContent);
      assert.strictEqual(stat, 'Parejas: 5', 'the reveal should show the ORIGINAL submitted score, not the practice-inflated one');

      const iconLabels = await page.$$eval('#reveal-icons .reveal__icon-cell', (els) => els.map((e) => e.getAttribute('aria-label')));
      assert.strictEqual(iconLabels.length, 5, 'reveal icons should reflect only the originally matched stations, not the extra practice match');

      const stored = await page.evaluate((k) => localStorage.getItem('memoria:' + k), DATE);
      assert.deepStrictEqual(JSON.parse(stored), { score: 5, won: false, matchedStations: ['Insurgentes', 'Zapata', 'Hidalgo', 'Balderas', 'Sevilla'], leaderboardSubmitted: true });

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
