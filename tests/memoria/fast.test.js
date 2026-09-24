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
  findMatchingStation,
  clickCardForStation,
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
        // The refill/reshuffle itself is immediate - only the reshuffle's
        // own ~350ms slide/pop-in needs waiting out here.
        await page.waitForTimeout(500);

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

  test('a match deals the next pair immediately, spawning a ghost of the matched pair colored by its own line, plus a same-colored "+1" popup', async () => {
    const { context, page, pageErrors } = await freshPage(TEST_DATE);
    try {
      await page.click('#start-btn');
      await page.waitForTimeout(150);

      const station = await findMatchingStation(page);
      const expectedLine = await page.evaluate((name) => {
        var line = MetroShared.LINES.find((l) => l.stations.includes(name));
        return { id: line.id, color: line.color };
      }, station);

      await clickCardForStation(page, station);
      await page.waitForTimeout(60);
      await clickCardForStation(page, station);

      // No wait at all here - the refill/reshuffle is no longer delayed
      // behind the flash, so the board should already show a full 8
      // unique stations (the matched pair replaced, not just held) the
      // instant the match resolves. Scoped to #memo-board since the two
      // ghost clones (still fading out, see below) also briefly show the
      // matched station and would otherwise double-count it.
      const uniqueStations = await page.$$eval('#memo-board .memo-card:not(.memo-card--empty)', (els) => {
        var counts = {};
        els.forEach((el) => {
          var label = el.getAttribute('aria-label') || (el.querySelector('.memo-card__name') || {}).textContent;
          counts[label] = (counts[label] || 0) + 1;
        });
        return Object.keys(counts).length;
      });
      assert.strictEqual(uniqueStations, 8, 'the refill should already be on the board, not held back behind the flash');

      // The flash lives on two ghost clones outside #memo-board entirely
      // (see spawnMatchGhost()), not on the live cells now showing the
      // new pair - those should be plain, uncolored cards.
      const liveFlashCount = await page.$$('#memo-board .memo-card--match-flash').then((els) => els.length);
      assert.strictEqual(liveFlashCount, 0, 'the live, freshly-dealt cards should not themselves be colored by the flash');

      const ghosts = await page.$$('.memo-card--match-ghost');
      assert.strictEqual(ghosts.length, 2, 'the just-matched pair should each get a ghost clone');
      for (const ghost of ghosts) {
        const bg = await ghost.evaluate((el) => getComputedStyle(el).getPropertyValue('--match-bg').trim());
        assert.strictEqual(bg, expectedLine.color, 'the ghost should be colored by the JUST-matched station\'s own line');
        const label = await ghost.evaluate((el) => el.getAttribute('aria-label') || (el.querySelector('.memo-card__name') || {}).textContent);
        assert.strictEqual(label, station, 'the ghost should still show the station that was actually matched');
      }

      const popup = await page.$('.memo-score-popup');
      const popupText = await popup.evaluate((el) => el.textContent);
      assert.strictEqual(popupText, '+1');
      const popupColorMatches = await page.evaluate((expected) => {
        var probe = document.createElement('div');
        probe.style.color = expected;
        document.body.appendChild(probe);
        var expectedComputed = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(document.querySelector('.memo-score-popup')).color === expectedComputed;
      }, expectedLine.color);
      assert.ok(popupColorMatches, 'the "+1" popup should be colored by the matched station\'s own line too');

      // A third, unrelated card should be immediately selectable - the
      // ghosts fading out never block the rest of the board.
      const thirdCard = await page.$('#memo-board .memo-card:not(.memo-card--empty):not(.memo-card--selected)');
      await thirdCard.click();
      assert.ok(await thirdCard.evaluate((el) => el.classList.contains('memo-card--selected')), 'a third card should be selectable right away, not blocked by the ghosts');

      // Past MATCH_FLASH_MS - both ghosts and the popup are gone.
      await page.waitForTimeout(700);
      assert.strictEqual(await page.$$('.memo-card--match-ghost').then((els) => els.length), 0, 'the ghosts should be removed once MATCH_FLASH_MS has passed');
      assert.strictEqual(await page.$('.memo-score-popup'), null, 'the popup should have removed itself');

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

  test('icon and name cards share the same background, and name text isn\'t left unreadable', async () => {
    const { context, page } = await freshPage(TEST_DATE);
    try {
      const info = await page.evaluate(() => {
        const iconCard = document.querySelector('.memo-card--icon');
        const nameCard = document.querySelector('.memo-card--name');
        const nameText = nameCard.querySelector('.memo-card__name');
        return {
          iconBg: getComputedStyle(iconCard).backgroundColor,
          nameBg: getComputedStyle(nameCard).backgroundColor,
          nameTextColor: getComputedStyle(nameText).color,
        };
      });
      assert.strictEqual(info.iconBg, info.nameBg, 'icon and name cards should share the same background');
      // Buttons don't inherit page text color by default - a name card
      // with no explicit color falls back to the browser's default
      // button text (black), which is nearly invisible on a dark card.
      assert.notStrictEqual(info.nameTextColor, 'rgb(0, 0, 0)', 'name text should not fall back to the browser default black button text');
    } finally {
      await context.close();
    }
  });

  test('the Comenzar button and timer bar pick the same deterministic per-day accent color', async () => {
    const { context: c1, page: p1 } = await freshPage(TEST_DATE);
    const { context: c2, page: p2 } = await freshPage(TEST_DATE);
    try {
      const readLine = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--line').trim());

      const line1 = await readLine(p1);
      const line2 = await readLine(p2);
      assert.strictEqual(line1, line2, 'the same date should pick the same accent color across sessions');
      assert.ok(/^#[0-9a-f]{6}$/i.test(line1), 'accent should be a real line color, got: ' + line1);

      const btnBg = await p1.evaluate(() => getComputedStyle(document.getElementById('start-btn')).backgroundColor);
      await p1.click('#start-btn');
      const barBg = await p1.evaluate(() => getComputedStyle(document.getElementById('timer-bar')).backgroundColor);
      assert.strictEqual(btnBg, barBg, 'Comenzar button and timer bar should render the same accent color');
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
