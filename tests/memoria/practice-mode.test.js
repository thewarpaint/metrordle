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
      assert.strictEqual(await page.locator('#progress-track').isVisible(), false, 'no countdown should run during practice');

      const cardCount = await page.locator('#memo-board .station-card:not(.station-card--empty)').count();
      assert.strictEqual(cardCount, 16, 'a fresh practice board should deal a full 16-card grid, since the finished day never had one saved');

      // Practice has its own stats, not the real round's - an elapsed-time
      // clock counting up from 0:00 (not the exact seconds, which are
      // timing-dependent) and a pairs-matched count starting at 0,
      // regardless of the planted result's own score of 3.
      const readStatus = async () => ({
        time: await page.$eval('#memo-time', (el) => el.textContent),
        pairs: await page.$eval('#memo-pairs', (el) => el.textContent),
      });

      const before = await readStatus();
      assert.match(before.time, /^0:0\d$/, 'practice clock should start its own elapsed count near zero, got: ' + before.time);
      assert.strictEqual(before.pairs, '0 parejas', 'practice pair count should start at zero, not the planted result\'s own score, got: ' + before.pairs);

      const matched = await matchOnePair(page);
      assert.ok(matched, 'expected a matchable pair on the fresh practice board');
      await page.waitForTimeout(250);

      const afterMatch = await readStatus();
      assert.strictEqual(afterMatch.pairs, '1 pareja', 'a practice match should bump the practice-only pair count to 1 (singular), not the real result\'s own score, got: ' + afterMatch.pairs);

      // The elapsed clock keeps ticking on its own, once a second, with no
      // further action from the player (continuePractice()'s own
      // setInterval(renderStatus, 1000), not a one-off read at entry time).
      await page.waitForTimeout(1200);
      const afterTick = await readStatus();
      assert.match(afterTick.time, /^0:0[1-9]$/, 'the elapsed-time stat should keep advancing on its own while practicing, got: ' + afterTick.time);
      assert.strictEqual(afterTick.pairs, '1 pareja', 'the practice pair count should hold at 1 while only the clock advances, got: ' + afterTick.pairs);

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

      const timeDuringPractice = await page.$eval('#memo-time', (el) => el.textContent);
      const pairsDuringPractice = await page.$eval('#memo-pairs', (el) => el.textContent);
      assert.match(timeDuringPractice, /^0:0\d$/, 'the practice clock should read near zero, got: ' + timeDuringPractice);
      assert.strictEqual(pairsDuringPractice, '1 pareja', 'the practice-only pair count should read 1, not the real result\'s own score of 5, got: ' + pairsDuringPractice);

      await page.click('#end-practice-btn');
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'should land back on the reveal screen');
      assert.strictEqual(await page.locator('#memo-board').isVisible(), false, 'the board should hide again');
      // #progress sits above the reveal banner and is never re-rendered
      // while 'done' (renderStatus() only runs for 'ready'/'playing'/
      // 'practice') - it must hide here, or it'd still show the stale
      // practice stats ("0:0x" / "1 pareja") right above the reveal's own,
      // correct "Parejas: 5", reading as two contradicting scores.
      assert.strictEqual(await page.locator('#progress').isVisible(), false, 'the progress bar should hide behind the reveal screen, not show stale practice stats');
      const stat = await page.$eval('#stat-you', (el) => el.textContent);
      assert.strictEqual(stat, 'Parejas: 5', 'the reveal should show the ORIGINAL submitted score, not the practice-inflated one');

      const iconLabels = await page.$$eval('#reveal-icons .reveal__icon-cell', (els) => els.map((e) => e.getAttribute('aria-label')));
      assert.strictEqual(iconLabels.length, 5, 'reveal icons should reflect only the originally matched stations, not the extra practice match');

      const stored = await page.evaluate((k) => localStorage.getItem('memoria:' + k), DATE);
      assert.deepStrictEqual(JSON.parse(stored), { score: 5, won: false, matchedStations: ['Insurgentes', 'Zapata', 'Hidalgo', 'Balderas', 'Sevilla'], leaderboardSubmitted: true });

      // endPractice() must clearInterval() the practice elapsed-time
      // ticker - a leaked one would keep calling renderStatus(), which
      // reads state.practiceSnapshot.score and throws once that's been
      // nulled out by endPractice() itself. Waiting out a full tick here
      // catches that regression as a page error.
      await page.waitForTimeout(1200);
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
