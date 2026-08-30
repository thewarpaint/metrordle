'use strict';

// Checks that don't require waiting out a real round timer - runs in
// well under a minute. See ../README.md for how to run this file.
//
// Covers: the start dialog gating the round, the 60s countdown
// actually ticking, the checkerboard card-type pattern holding on the
// initial board and after matches, the post-match reshuffle touching
// exactly 4 cards, board determinism for a given date, and ?debug=true
// date navigation.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const {
  checkerboardOk,
  getCardTypes,
  getCells,
  matchOnePair,
  keyedRects,
} = require('../lib/memoria-helpers');

const TEST_DATE = '2026-09-15';
const TEST_DATE_2 = '2026-09-17';

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  async function freshPage(dateKey) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + dateKey, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    return { context, page, pageErrors };
  }

  test('start dialog blocks the round until "Comenzar" is clicked', async () => {
    const { context, page } = await freshPage(TEST_DATE);
    try {
      assert.strictEqual(await page.locator('#start-overlay').isVisible(), true, 'overlay should be visible on load');

      const status = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(status, '60s · 0 parejas', 'status should preview the full round length before starting');

      const cells = await getCells(page);
      assert.strictEqual(cells.length, 16, 'board should have 16 cells even before the round starts');
      assert.ok(cells.every((c) => c.disabled), 'every card should be disabled while the dialog is up');

      await page.click('#start-btn');
      await page.waitForTimeout(150);
      assert.strictEqual(await page.locator('#start-overlay').isVisible(), false, 'overlay should hide once started');

      const cellsAfterStart = await getCells(page);
      assert.ok(cellsAfterStart.every((c) => !c.disabled), 'cards should be clickable once the round starts');
    } finally {
      await context.close();
    }
  });

  test('round counts down for real from 60 seconds', async () => {
    const { context, page } = await freshPage(TEST_DATE);
    try {
      await page.click('#start-btn');
      const atStart = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(atStart, '60s · 0 parejas');

      await page.waitForTimeout(1200);
      const afterOneTick = await page.$eval('#status', (el) => el.textContent);
      assert.strictEqual(afterOneTick, '59s · 0 parejas', 'status should tick down to 59s after ~1s');
    } finally {
      await context.close();
    }
  });

  test('checkerboard card-type pattern holds on the initial board', async () => {
    const { context, page } = await freshPage(TEST_DATE);
    try {
      await page.click('#start-btn');
      await page.waitForTimeout(150);
      const types = await getCardTypes(page);
      assert.deepStrictEqual(checkerboardOk(types), { ok: true });
    } finally {
      await context.close();
    }
  });

  test('matching a pair repositions exactly 4 cards and preserves invariants', async () => {
    const { context, page, pageErrors } = await freshPage(TEST_DATE);
    try {
      await page.click('#start-btn');
      await page.waitForTimeout(150);

      for (let round = 0; round < 4; round++) {
        const before = await keyedRects(page);
        const station = await matchOnePair(page);
        assert.ok(station, 'there should always be a matchable pair on the board');
        await page.waitForTimeout(450); // let the slide/pop-in animation settle

        const after = await keyedRects(page);
        let movedExisting = 0;
        let freshlyAdded = 0;
        Object.keys(after).forEach((key) => {
          if (!(key in before)) { freshlyAdded++; return; }
          const b = before[key];
          const a = after[key];
          if (Math.abs(b.left - a.left) > 1 || Math.abs(b.top - a.top) > 1) movedExisting++;
        });

        assert.strictEqual(freshlyAdded, 2, 'exactly the refilled icon+name card should be new, round ' + round);
        assert.strictEqual(movedExisting, 2, 'exactly 2 other existing cards should have moved, round ' + round);

        const types = await getCardTypes(page);
        assert.deepStrictEqual(checkerboardOk(types), { ok: true }, 'checkerboard should still hold, round ' + round);

        const cells = await getCells(page);
        const counts = {};
        cells.filter((c) => !c.matched && !c.empty).forEach((c) => { counts[c.label] = (counts[c.label] || 0) + 1; });
        assert.strictEqual(Object.keys(counts).length, 8, 'board should always show exactly 8 unique stations, round ' + round);
        assert.ok(Object.values(counts).every((v) => v === 2), 'every station should have exactly one icon + one name card, round ' + round);
      }

      assert.deepStrictEqual(pageErrors, [], 'no JS errors during play');
    } finally {
      await context.close();
    }
  });

  test('the same date produces an identical board across independent sessions', async () => {
    const { context: c1, page: p1 } = await freshPage(TEST_DATE_2);
    const { context: c2, page: p2 } = await freshPage(TEST_DATE_2);
    try {
      await p1.click('#start-btn');
      await p2.click('#start-btn');
      await p1.waitForTimeout(150);
      await p2.waitForTimeout(150);

      const cells1 = await getCells(p1);
      const cells2 = await getCells(p2);
      assert.deepStrictEqual(cells1, cells2, 'two fresh sessions on the same date should see the same initial board');
    } finally {
      await c1.close();
      await c2.close();
    }
  });

  test('?debug=true date navigation loads a different day\'s board', async () => {
    const { context, page } = await freshPage(TEST_DATE);
    try {
      await page.click('#start-btn');
      await page.waitForTimeout(150);
      const titleBefore = await page.$eval('#game-title', (el) => el.textContent);
      const cellsBefore = await getCells(page);

      await page.click('#date-next');
      await page.waitForTimeout(150);
      const titleAfter = await page.$eval('#game-title', (el) => el.textContent);
      const cellsAfter = await getCells(page);

      assert.notStrictEqual(titleBefore, titleAfter, 'game number should change when navigating to a different day');
      assert.notDeepStrictEqual(cellsBefore, cellsAfter, 'board should be different on a different day');
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
