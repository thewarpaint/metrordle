'use strict';

// Covers Memoria's hard mode (the elastic clock, ported from Copo de
// nieve): the start overlay's normal/hard choice, the +1/−1 clock cue on
// a correct run vs. a committed wrong guess, the penalty-free same-type
// re-selection, and the hard-only reveal stats / 🧠 share line. The
// reveal/share checks plant a finished result and reload (same fast trick
// leaderboard.test.js/practice-mode.test.js use) rather than waiting out a
// real 60s round - the elastic-clock cues themselves are checked live.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { matchOnePair } = require('../lib/memoria-helpers');

// Board cards as the player sees them, in grid order (same scoping to
// #memo-board as memoria-helpers, so a fading ghost clone can't skew it).
function cardInfo(page) {
  return page.$$eval('#memo-board .station-card', function (els) {
    return els.map(function (e) {
      var nameEl = e.querySelector('.station-card__name');
      return {
        empty: e.classList.contains('station-card--empty'),
        type: e.classList.contains('station-card--icon') ? 'icon'
          : e.classList.contains('station-card--name') ? 'name' : 'empty',
        label: e.getAttribute('aria-label') || (nameEl ? nameEl.textContent : null),
      };
    });
  });
}

async function clickCardAt(page, index) {
  await page.locator('#memo-board .station-card').nth(index).click();
}

async function plantResult(page, dateKey, result) {
  await page.evaluate(function (args) {
    localStorage.setItem('memoria:' + args.dateKey, JSON.stringify(args.result));
  }, { dateKey: dateKey, result: result });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the start overlay offers a normal and a hard mode, with the hard-mode explanation', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=2026-10-05', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#start-normal-btn').isVisible(), true, 'the normal-mode button should show');
      assert.strictEqual(await page.locator('#start-hard-btn').isVisible(), true, 'the hard-mode button should show');
      const explain = await page.$eval('#start-overlay .start-overlay__text', (el) => el.textContent);
      assert.ok(/difícil/i.test(explain) && /5 aciertos/.test(explain), 'the hard-mode explanation should describe the elastic clock, got: ' + explain);
    } finally {
      await context.close();
    }
  });

  test('hard mode: a run of five correct pairs banks a clock second (+1 cue)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=2026-10-06', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.click('#start-hard-btn');
      await page.waitForTimeout(100);

      // A refill always re-deals the just-matched slots as the SAME next
      // station's icon+name, so there's always a matchable pair to take -
      // five in a row with no wrong guess in between trips HARD_BONUS_RUN.
      for (var i = 0; i < 5; i++) {
        await matchOnePair(page);
        await page.waitForTimeout(80);
      }

      const deltaClass = await page.$eval('#memo-delta', (el) => el.className);
      assert.ok(/attempt-chip--good/.test(deltaClass), 'five correct pairs should flash a +1 bonus, got: ' + deltaClass);
      assert.deepStrictEqual(errors, [], 'no page errors');
    } finally {
      await context.close();
    }
  });

  test('hard mode: a cross-type non-match costs a second (−1 cue); a same-type re-selection is free', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=2026-10-07', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.click('#start-hard-btn');
      await page.waitForTimeout(100);

      // Same-type re-selection first, while the delta chip is still
      // pristine: two icon cells can never be a pair, so this just moves
      // the selection - no penalty, in any mode.
      var info = await cardInfo(page);
      var icons = [];
      info.forEach(function (c, i) { if (!c.empty && c.type === 'icon') icons.push(i); });
      await clickCardAt(page, icons[0]);
      await page.waitForTimeout(60);
      await clickCardAt(page, icons[1]);
      await page.waitForTimeout(60);

      var deltaAfterSameType = await page.$eval('#memo-delta', (el) => el.className);
      assert.strictEqual(deltaAfterSameType, 'clock__delta', 'a same-type re-selection should not flash any clock cue, got: ' + deltaAfterSameType);

      // Deselect the card still picked from above, then commit a real
      // wrong guess: an icon card and a NON-matching name card.
      await clickCardAt(page, icons[1]);
      await page.waitForTimeout(60);

      info = await cardInfo(page);
      var iconIdx = info.findIndex(function (c) { return !c.empty && c.type === 'icon'; });
      var nameIdx = info.findIndex(function (c) { return !c.empty && c.type === 'name' && c.label !== info[iconIdx].label; });
      await clickCardAt(page, iconIdx);
      await page.waitForTimeout(60);
      await clickCardAt(page, nameIdx);
      await page.waitForTimeout(60);

      var deltaAfterWrong = await page.$eval('#memo-delta', (el) => el.className);
      assert.ok(/attempt-chip--bad/.test(deltaAfterWrong), 'a cross-type non-match should flash a −1 penalty, got: ' + deltaAfterWrong);
      assert.deepStrictEqual(errors, [], 'no page errors');
    } finally {
      await context.close();
    }
  });

  test('a finished hard round shows its seconds stats and a 🧠 share line; a normal round shows neither', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    try {
      // Hard result.
      const HARD_DATE = '2026-10-08';
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + HARD_DATE, { waitUntil: 'networkidle' });
      await plantResult(page, HARD_DATE, {
        score: 6, won: false, matchedStations: ['Pino Suárez'],
        mode: 'hard', secondsWon: 2, secondsLost: 3, leaderboardSubmitted: true,
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted hard result');
      assert.strictEqual(await page.locator('#reveal-stats').isVisible(), true, 'the seconds stat-grid should show in hard mode');
      assert.strictEqual(await page.$eval('#reveal-seconds-won', (el) => el.textContent), '2');
      assert.strictEqual(await page.$eval('#reveal-seconds-lost', (el) => el.textContent), '3');

      await page.click('#share-btn');
      await page.waitForTimeout(300);
      const hardShare = await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(hardShare.indexOf('🧠 Modo difícil') !== -1, 'hard-mode share text should carry the 🧠 line, got: ' + hardShare);

      // Normal result on another day: no stats, no 🧠 line.
      const NORMAL_DATE = '2026-10-09';
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + NORMAL_DATE, { waitUntil: 'networkidle' });
      await plantResult(page, NORMAL_DATE, {
        score: 4, won: false, matchedStations: ['Pino Suárez'], leaderboardSubmitted: true,
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted normal result');
      assert.strictEqual(await page.locator('#reveal-stats').isVisible(), false, 'the seconds stat-grid should stay hidden in normal mode');

      await page.click('#share-btn');
      await page.waitForTimeout(300);
      const normalShare = await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(normalShare.indexOf('🧠') === -1, 'normal-mode share text should omit the 🧠 line, got: ' + normalShare);
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
