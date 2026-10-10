'use strict';

// Covers the leaderboard feature on the main game (/, its own
// 'metrordle-leaderboard' Firestore collection, no localStorage fallback -
// see shared.js's submitLeaderboardScore/getTopLeaderboardScores). One
// combined leaderboard, not split by normal/hard mode: fewer attempts
// wins, a loss always sorts after every win, and a hard-mode entry beats
// a normal-mode entry at the same attempts count (see index.html's
// renderLeaderboard() orderBySpecs). This sandboxed test environment
// can't reach Firestore at all (gstatic.com is unreachable), which is
// itself a useful case to cover: the leaderboard section must still
// render (an empty-state message, not an error) and the page must not
// throw, exactly like a real player whose network blocks Firebase.
//
// Uses a fabricated-history-planted-in-localStorage trick (see
// tests/laberinto/leaderboard.test.js's fabricated-path equivalent) to
// reach the reveal screen instantly instead of actually solving the
// daily puzzle - loadSavedState() only checks that `history` is an
// array, so the exact guesses don't need to be real.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedGame(page, dateKey, attempts, won, mode, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    var dummyGuess = ['A', 'B', 'C', 'D', 'E'];
    var history = [];
    for (var i = 0; i < args.attempts; i++) {
      history.push({ guess: dummyGuess, correctCount: i === args.attempts - 1 && args.won ? 5 : 2 });
    }
    localStorage.setItem('metrordle:' + args.dateKey, JSON.stringify({
      history: history,
      gameOver: true,
      won: !!args.won,
      mode: args.mode,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey: dateKey, attempts: attempts, won: won, mode: mode, leaderboardSubmitted: leaderboardSubmitted });
}

// Captures the fields object a submission would actually send, without
// needing a real (unreachable in this sandbox) Firestore project -
// same route-interception trick tests/admin/admin.test.js uses for
// getTopLeaderboardScores(), applied to submitLeaderboardScore() instead.
async function stubSubmit(page) {
  await page.route('**/shared.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body + `
      (function () {
        window.__submittedFields = null;
        window.MetroShared.submitLeaderboardScore = function (collectionName, dateKey, alias, fields) {
          window.__submittedFields = fields;
          return Promise.resolve();
        };
      })();
    `;
    // Without this, the test server's own Last-Modified/ETag headers
    // (copied from `response` by default) make the browser serve the
    // FIRST patched response straight from its disk cache on the next
    // navigation (this test's own page.reload()) - no network request
    // at all, so this route handler never runs a second time and the
    // real, unpatched shared.js (already loaded before the reload)
    // keeps controlling window.MetroShared instead.
    await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders above the guess-board details and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2026-12-23';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedGame(page, DATE, 3, true, 'normal', false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted won state');

      const titleText = await page.$eval('.leaderboard__title', (el) => el.textContent);
      assert.strictEqual(titleText, 'Mejores 5 puntajes hoy');

      const order = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#leaderboard, #guess-board'));
        return nodes.map((n) => n.id);
      });
      assert.deepStrictEqual(order, ['leaderboard', 'guess-board'], 'leaderboard should come before the guess-board details in the DOM');

      // No Firestore reachable in this sandbox and no local fallback on
      // this page - getTopLeaderboardScores() resolves to [] rather than
      // throwing, so this should render the empty-state message instead
      // of an error.
      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message when Firebase is unreachable');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('saving an alias persists it site-wide without a page error, even under ?debug=true', async () => {
    const DATE = '2026-12-24';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedGame(page, DATE, 2, true, 'hard', false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const inputVisible = await page.locator('#leaderboard-alias-row input').isVisible();
      assert.strictEqual(inputVisible, true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Eduardo');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(300);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Eduardo'), 'should show the saved alias, got: ' + displayText);

      const storedAlias = await page.evaluate(() => localStorage.getItem('metrordle:alias'));
      assert.strictEqual(storedAlias, 'Eduardo');

      // ?debug=true means submitScore() should skip entirely (see
      // index.html) - the saved state's leaderboardSubmitted flag should
      // stay false, not get set by a debug-mode play.
      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('metrordle:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a debug-mode play should never mark leaderboardSubmitted true');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a loss now submits too (attempts: 5, lost: true), and shows the alias row instead of hiding it', async () => {
    const DATE = '2026-12-25';
    // serviceWorkers: 'block' - this page registers a real service
    // worker (sw.js) that precaches /shared.js; without blocking it, a
    // page.reload() below can end up served from the SW's own Cache
    // Storage instead of hitting the network a second time, bypassing
    // the page.route() patch this test depends on (route() doesn't see
    // SW-served resources).
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      // Deliberately NOT ?debug=true here - that skips submitScore()
      // entirely, which would defeat the point of this test.
      await stubSubmit(page);
      await page.goto(server.baseUrl + '/?date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Eduardo'));
      await plantSavedGame(page, DATE, 5, false, 'normal', false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#leaderboard').isVisible(), true, 'the leaderboard section should still show on a loss');
      assert.strictEqual(await page.locator('#leaderboard-alias-row').isVisible(), true, 'the alias row should show on a loss now (there is something meaningful to submit), not stay hidden like before');

      const fields = await page.evaluate(() => window.__submittedFields);
      assert.ok(fields, 'submitScore() should have attempted a submission on a loss now');
      assert.strictEqual(fields.attempts, 5, 'a loss always uses every attempt');
      assert.strictEqual(fields.lost, true);

      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('metrordle:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, true, 'a successful submission should mark leaderboardSubmitted true, same as a win');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a lost entry renders "-" instead of an attempts number, ranked after every win', async () => {
    const DATE = '2026-12-26';
    // serviceWorkers: 'block' - see the previous test's own comment.
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.route('**/shared.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const patched = body + `
          (function () {
            var DATA = [
              { id: 'ana', alias: 'Ana', attempts: 3, hardMode: false, lost: false },
              // A loss's own attempts (always 5, TOTAL_ATTEMPTS) ties
              // numerically with a nail-biter win at the same count -
              // lost is what still has to sort this one last.
              { id: 'beto', alias: 'Beto', attempts: 5, hardMode: false, lost: true },
              { id: 'caro', alias: 'Caro', attempts: 5, hardMode: false, lost: false },
            ];
            window.MetroShared.getTopLeaderboardScores = function () {
              return Promise.resolve(DATA.slice().sort(function (a, b) {
                if (a.attempts !== b.attempts) return a.attempts - b.attempts;
                return Number(a.lost) - Number(b.lost);
              }));
            };
          })();
        `;
        await route.fulfill({ response, body: patched });
      });
      await page.goto(server.baseUrl + '/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedGame(page, DATE, 3, true, 'normal', true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#leaderboard-list .leaderboard__row');
      assert.strictEqual(await rows.count(), 3);

      const names = await rows.locator('.leaderboard__alias-name').allTextContents();
      assert.deepStrictEqual(names, ['Ana', 'Caro', 'Beto'], 'the loss (Beto) should rank last despite tying Caro\'s own attempts count');

      const numbers = await rows.locator('.leaderboard__score-number').allTextContents();
      assert.deepStrictEqual(numbers, ['3', '5', '-'], 'the lost row should show "-", not a number');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('shows a 🔥 × N streak badge per row (N > 1 only), fed by getTopLeaderboardScores() extraFields', async () => {
    const DATE = '2026-12-27';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.route('**/shared.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const patched = body + `
          (function () {
            var DATA = [
              { id: 'ana', alias: 'Ana', attempts: 2, hardMode: false, streak: 5 },
              // A streak of 1 ("played today" but not yet a streak worth
              // calling out) and no streak field at all (predates the
              // field) should both render nothing.
              { id: 'beto', alias: 'Beto', attempts: 3, hardMode: false, streak: 1 },
              { id: 'caro', alias: 'Caro', attempts: 4, hardMode: false },
            ];
            window.MetroShared.getTopLeaderboardScores = function () {
              return Promise.resolve(DATA);
            };
          })();
        `;
        await route.fulfill({ response, body: patched, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } });
      });
      await page.goto(server.baseUrl + '/?date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedGame(page, DATE, 3, true, 'normal', true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = page.locator('#leaderboard-list .leaderboard__row');
      assert.strictEqual(await rows.count(), 3);

      const streaks = await rows.locator('.leaderboard__streak').allTextContents();
      assert.deepStrictEqual(streaks, ['🔥 × 5', '', ''], 'only a streak > 1 should render, everything else should show nothing');

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
