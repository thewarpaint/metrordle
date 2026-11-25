'use strict';

// Sopa de metros is a monthly challenge: one materialized board per calendar
// month (MONTHLY_PUZZLES, keyed 'YYYY-MM'), solvable once, with months that
// have no config showing a "sin reto" state. These drive the page with
// ?date= to pin the active month regardless of the real clock. Firebase is
// unreachable in this sandbox (the harness 404s the vendored SDK), so the
// leaderboard submit degrades silently - these cover the board/behavior, not
// the write.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

// The 10 stations hidden in every grid; the solver finds each in the DOM grid
// and taps its cells (same path a player takes).
const WORDS = ['ACULCO', 'COYOACAN', 'CULHUACAN', 'MIXCOAC', 'MIXIUHCA', 'PANTITLAN', 'POPOTLA', 'TACUBA', 'TLATELOLCO', 'ZAPOTITLAN'];

function solveBoard() {
  var N = 12, grid = [];
  for (var r = 0; r < N; r++) { grid.push([]); for (var c = 0; c < N; c++) grid[r].push(null); }
  document.querySelectorAll('.cell').forEach(function (el) { grid[+el.dataset.r][+el.dataset.c] = el.textContent; });
  function cellEl(r, c) { return document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]'); }
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
  var W = ['ACULCO', 'COYOACAN', 'CULHUACAN', 'MIXCOAC', 'MIXIUHCA', 'PANTITLAN', 'POPOTLA', 'TACUBA', 'TLATELOLCO', 'ZAPOTITLAN'];
  function find(w) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], ok = true, p = [];
      for (var k = 0; k < w.length; k++) { var rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= N || cc < 0 || cc >= N || grid[rr][cc] !== w.charAt(k)) { ok = false; break; } p.push([rr, cc]); }
      if (ok) return p;
    }
    return null;
  }
  var missing = [];
  W.forEach(function (w) { var p = find(w); if (!p) { missing.push(w); return; } p.forEach(function (x) { cellEl(x[0], x[1]).dispatchEvent(new MouseEvent('click', { bubbles: true })); }); });
  return missing;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  async function open(url) {
    const context = await browser.newContext({ viewport: { width: 420, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/www.gstatic.com/**', (r) => r.abort());
    await page.goto(server.baseUrl + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    return { context, page, errors };
  }

  test("a month with a config renders a solvable board titled for that month", async () => {
    const { context, page, errors } = await open('/sopa-de-metros/?date=2026-12-15');
    try {
      assert.strictEqual(await page.locator('#game-title').textContent(), 'Sopa de metros: diciembre');
      assert.strictEqual(await page.locator('.cell').count(), 144, 'a 12x12 grid');
      assert.strictEqual(await page.locator('#clues .clue').count(), 10, 'all 10 clues in Pistas');
      assert.strictEqual(await page.locator('.board').evaluate((el) => el.hidden), false, 'board visible');
      const missing = await page.evaluate(solveBoard);
      assert.deepStrictEqual(missing, [], 'every word is locatable in the stored grid');
      await page.waitForTimeout(150);
      assert.strictEqual(await page.locator('#progress-count').textContent(), '10 / 10');
      assert.strictEqual(await page.locator('#win-notice').evaluate((el) => el.hidden), false, 'win banner shows');
      assert.strictEqual(errors.length, 0, 'no page errors: ' + errors.join('; '));
    } finally {
      await context.close();
    }
  });

  test("a solved month stays locked on reload (no replay without debug)", async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('**/www.gstatic.com/**', (r) => r.abort());
    try {
      await page.goto(server.baseUrl + '/sopa-de-metros/?date=2026-12-15', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      await page.evaluate(solveBoard);
      await page.waitForTimeout(150);
      // Reload the same month: restores straight into the solved/won state.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      assert.strictEqual(await page.locator('#progress-count').textContent(), '10 / 10', 'restored solved');
      assert.strictEqual(await page.locator('#win-notice').evaluate((el) => el.hidden), false, 'win banner on reload');
      assert.strictEqual(await page.locator('.actions').evaluate((el) => el.hidden), true, 'no replay button in normal play');
      // The board is inert once won: tapping a cell changes nothing.
      const before = await page.locator('.cell--sel').count();
      await page.locator('.cell').first().dispatchEvent('click');
      await page.waitForTimeout(80);
      assert.strictEqual(await page.locator('.cell--sel').count(), before, 'taps ignored on a solved board');
    } finally {
      await context.close();
    }
  });

  test("a month with no config shows the 'sin reto' state", async () => {
    const { context, page, errors } = await open('/sopa-de-metros/?date=2099-01-15');
    try {
      assert.strictEqual(await page.locator('#game-title').textContent(), 'Sopa de metros: enero');
      assert.strictEqual(await page.locator('.board').evaluate((el) => el.hidden), true, 'board hidden');
      assert.strictEqual(await page.locator('.progress').evaluate((el) => el.hidden), true, 'progress hidden');
      assert.strictEqual(await page.locator('#pistas-group').evaluate((el) => el.hidden), true, 'pistas hidden');
      assert.strictEqual(await page.locator('#leaderboard').evaluate((el) => el.hidden), true, 'leaderboard hidden');
      assert.strictEqual(await page.locator('#win-notice').evaluate((el) => el.hidden), false, 'notice shown');
      assert.ok((await page.locator('#win-notice').textContent()).indexOf('Sin reto este mes') !== -1, 'sin-reto copy');
      assert.strictEqual(errors.length, 0, 'no page errors: ' + errors.join('; '));
    } finally {
      await context.close();
    }
  });

  test("the Nueva sopa replay button is debug-only", async () => {
    let r = await open('/sopa-de-metros/?date=2026-12-15');
    try {
      assert.strictEqual(await r.page.locator('.actions').evaluate((el) => el.hidden), true, 'hidden in normal play');
    } finally { await r.context.close(); }
    r = await open('/sopa-de-metros/?date=2026-12-15&debug=true');
    try {
      assert.strictEqual(await r.page.locator('.actions').evaluate((el) => el.hidden), false, 'shown under ?debug=true');
      assert.strictEqual(await r.page.locator('#restart-btn').isVisible(), true);
    } finally { await r.context.close(); }
  });

  test("the leaderboard shows the empty state, then prompts for an alias after a solve", async () => {
    const { context, page, errors } = await open('/sopa-de-metros/?date=2026-12-15');
    try {
      // Firebase is unreachable in the sandbox, so the standings read empty.
      assert.strictEqual(await page.locator('#leaderboard').evaluate((el) => el.hidden), false, 'leaderboard visible');
      assert.strictEqual(await page.locator('#leaderboard-alias-row').evaluate((el) => el.hidden), true, 'no alias row before solving');
      assert.strictEqual(await page.locator('#leaderboard-status').evaluate((el) => el.hidden), false, 'empty-state status shown');
      assert.ok((await page.locator('#leaderboard-status').textContent()).indexOf('Sé el primero') !== -1, 'empty-state copy');
      await page.evaluate(solveBoard);
      await page.waitForTimeout(150);
      // No site-wide alias in a fresh context -> the claim-your-spot input appears.
      assert.strictEqual(await page.locator('#leaderboard-alias-row').evaluate((el) => el.hidden), false, 'alias row shown after solving');
      assert.strictEqual(await page.locator('#leaderboard-alias-row input').count(), 1, 'alias input present');
      assert.strictEqual(errors.length, 0, 'no page errors: ' + errors.join('; '));
    } finally {
      await context.close();
    }
  });

  const failed = await runAll();
  await browser.close();
  server.stop();
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
