'use strict';

// Covers the bug report "Metro Crush flickers every time a station is
// selected": onTileClick()'s own plain-selection branches (selecting a
// tile, deselecting the same one, or moving the selection to a
// different non-adjacent tile - none of which change the board data
// itself) used to call the same render() a real move does, which does
// `els.board.innerHTML = ''` and rebuilds every ROWS*COLS tile from
// scratch, including each tile's own station-icon SVG - destroying and
// recreating 56 DOM nodes just to toggle one tile's own class is what
// actually read as a flicker. Fixed by routing a plain selection change
// through a dedicated updateSelectedTileClasses() instead (same shape
// as Memoria's own updateSelectionClasses() for the identical bug
// class - see AGENTS.md's Memoria bullet). These tests assert on DOM
// node IDENTITY (a tag planted on each tile before the click, still
// there after) rather than anything visual, since that's the actual
// mechanism being fixed - a full rebuild can't preserve node identity,
// a class toggle always does.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function startNormalRound(page, server, dateKey) {
  await page.goto(server.baseUrl + '/metrocrush/?date=' + dateKey, { waitUntil: 'networkidle' });
  await page.click('#start-normal-btn');
  await page.waitForTimeout(150);
}

async function tagTiles(page) {
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('#board .tile')).forEach((el, i) => {
      el.dataset.probe = 'tile-' + i;
    });
  });
}

function getProbes(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#board .tile')).map((el) => el.dataset.probe));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('selecting a tile toggles its class without rebuilding any board DOM nodes', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await startNormalRound(page, server, '2027-04-01');
      await tagTiles(page);
      const before = await getProbes(page);

      await page.click('#board .tile:not(.tile--empty)');

      const after = await getProbes(page);
      assert.deepStrictEqual(after, before, 'expected the same DOM nodes after selecting a tile');
      assert.strictEqual(await page.locator('.tile--selected').count(), 1);
      assert.strictEqual(await page.locator('#board .tile:not(.tile--empty)').first().getAttribute('aria-pressed'), 'true');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('clicking the same selected tile again deselects it, still without rebuilding any board DOM nodes', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await startNormalRound(page, server, '2027-04-02');
      await tagTiles(page);
      const before = await getProbes(page);

      const firstTile = page.locator('#board .tile:not(.tile--empty)').first();
      await firstTile.click();
      await firstTile.click();

      const after = await getProbes(page);
      assert.deepStrictEqual(after, before, 'expected the same DOM nodes after deselecting');
      assert.strictEqual(await page.locator('.tile--selected').count(), 0);
      assert.strictEqual(await firstTile.getAttribute('aria-pressed'), null, 'aria-pressed should be removed entirely, not set to false');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('selecting a different, non-adjacent tile moves the selection without rebuilding any board DOM nodes', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await startNormalRound(page, server, '2027-04-03');
      await tagTiles(page);
      const before = await getProbes(page);

      // Index 0 and the last index are opposite corners of the board -
      // never adjacent regardless of ROWS/COLS, so this always re-selects
      // rather than attempting a swap.
      const tiles = page.locator('#board .tile:not(.tile--empty)');
      const count = await tiles.count();
      await tiles.first().click();
      await tiles.last().click();

      const after = await getProbes(page);
      assert.deepStrictEqual(after, before, 'expected the same DOM nodes after moving the selection');
      assert.strictEqual(await page.locator('.tile--selected').count(), 1, 'only the newly-selected tile should carry the class');
      assert.strictEqual(await tiles.first().getAttribute('aria-pressed'), null, 'the previously-selected tile should be deselected');
      assert.strictEqual(await tiles.last().getAttribute('aria-pressed'), 'true');
      assert.ok(count > 1, 'sanity check: the board should have more than one real tile');

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
