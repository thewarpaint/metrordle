'use strict';

// Covers the leaderboard feature on /metroguessr/ (its own
// 'metroguessr-leaderboard' Firestore collection, no localStorage
// fallback - see shared.js's submitLeaderboardScore/
// getTopLeaderboardScores). Ranked ascending by fewest attempts, like
// Metrordle/Laberinto, not Memoria: a loss has no meaningful "attempts
// to solve," so only a win ever submits. This sandboxed test
// environment can't reach Firestore at all (gstatic.com is
// unreachable), which is itself a useful case to cover: the leaderboard
// section must still render (an empty-state message, not an error) and
// the page must not throw, exactly like a real player whose network
// blocks Firebase.
//
// Uses a fabricated-guesses-planted-in-localStorage trick (see
// tests/laberinto/leaderboard.test.js's fabricated-path equivalent) to
// reach the reveal screen instantly instead of actually guessing the
// day's real target - loadSavedState() only checks that `guesses` is
// an array and looks at the last entry's `correct` flag, so a fake
// station name reaching a done+won state doesn't need to be the real
// target. The real map is still stubbed (see leaflet-stub.js) since the
// page can't render at all without it.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap } = require('../lib/metroguessr-helpers');

async function plantState(page, dateKey, guesses, done, leaderboardSubmitted) {
  await page.evaluate((args) => {
    localStorage.setItem('metroguessr:' + args.dateKey, JSON.stringify({
      guesses: args.guesses,
      done: args.done,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { dateKey, guesses, done, leaderboardSubmitted });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the leaderboard section renders and degrades gracefully with no reachable Firebase', async () => {
    const DATE = '2026-12-20';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantState(page, DATE, [{ name: 'Estacion Falsa', dist: 0, correct: true }], true, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted won state');

      const titleText = await page.locator('.leaderboard__title').textContent();
      assert.strictEqual(titleText, 'Mejores 5 puntajes hoy');

      // No Firestore reachable in this sandbox and no local fallback on
      // this page - getTopLeaderboardScores() resolves to [] rather
      // than throwing, so this should render the empty-state message
      // instead of an error.
      assert.strictEqual(await page.locator('#leaderboard-status').isVisible(), true, 'expected the empty-state leaderboard message when Firebase is unreachable');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('saving an alias persists it site-wide without a page error, even under ?debug=true', async () => {
    const DATE = '2026-12-21';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantState(page, DATE, [{ name: 'Estacion Falsa', dist: 0, correct: true }], true, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      assert.strictEqual(await page.locator('#leaderboard-alias-row input').isVisible(), true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Eduardo');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(300);

      const displayText = await page.locator('#leaderboard-alias-row').textContent();
      assert.ok(displayText.includes('Eduardo'), 'should show the saved alias, got: ' + displayText);

      const storedAlias = await page.evaluate(() => localStorage.getItem('metrordle:alias'));
      assert.strictEqual(storedAlias, 'Eduardo');

      // ?debug=true means submitScore() should skip entirely - the
      // saved state's leaderboardSubmitted flag should stay false, not
      // get set by a debug-mode play.
      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('metroguessr:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a debug-mode play should never mark leaderboardSubmitted true');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a loss never has anything to submit, but still shows the leaderboard section without error', async () => {
    const DATE = '2026-12-22';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Eduardo'));
      // Real station names, not placeholders - even a restored guess
      // re-renders its history chip (appendHistoryChip()), which looks
      // up the guess's own coordinates by name to compute a bearing;
      // a name that isn't a real station throws instead of rendering.
      await plantState(page, DATE, [
        { name: 'Zócalo', dist: 4, correct: false },
        { name: 'Chapultepec', dist: 3, correct: false },
        { name: 'Pantitlán', dist: 2, correct: false },
        { name: 'Tacubaya', dist: 1, correct: false },
        { name: 'Universidad', dist: 5, correct: false },
      ], true, false);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      assert.strictEqual(await page.locator('#leaderboard').isVisible(), true, 'the leaderboard section should still show on a loss');

      const saved = await page.evaluate((d) => JSON.parse(localStorage.getItem('metroguessr:' + d)), DATE);
      assert.strictEqual(saved.leaderboardSubmitted, false, 'a loss should never mark leaderboardSubmitted true - there is no meaningful attempts count to rank');

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
