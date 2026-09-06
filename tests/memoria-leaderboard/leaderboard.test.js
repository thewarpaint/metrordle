'use strict';

// Covers /memoria-leaderboard/, a staging copy of the Memoria page used
// to test the daily leaderboard feature before it ships on the real
// /memoria/ page. Firebase isn't configured for these tests (no real
// project credentials belong in this repo - see firebase-config.js), so
// this staging page falls back to a localStorage-backed fake leaderboard
// (see shared.js's `useLocalFallback` option) - these checks exercise
// that fallback actually working end to end (a submission really shows
// up, sorted correctly), not real reads/writes against a live Firestore
// backend. Once a real Firebase project is wired up, do one manual
// smoke test against it (a real submission appearing in the Firebase
// console under memoria-leaderboard-staging, and a ?debug=true play NOT
// appearing there).
//
// Uses a saved-result-planted-in-localStorage trick (see
// memoria-leaderboard/index.html's loadSavedResult) to reach the reveal
// screen instantly instead of waiting out a real 60s round. Reaching
// 'done' this way still exercises the real submitScore() call (see
// startNewGame's saved branch), so it's a genuine test of the submit
// path too, not just of rendering pre-existing data.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

const PAGE_PATH = '/memoria-leaderboard/';
const STORAGE_PREFIX = 'memoria-leaderboard-staging:';
const FALLBACK_COLLECTION = 'memoria-leaderboard-staging';

async function plantSavedResult(page, dateKey, score, matchedStations, leaderboardSubmitted) {
  await page.evaluate(function (args) {
    localStorage.setItem(args.prefix + args.dateKey, JSON.stringify({
      score: args.score,
      won: args.score >= 8,
      matchedStations: args.matchedStations,
      leaderboardSubmitted: !!args.leaderboardSubmitted,
    }));
  }, { prefix: STORAGE_PREFIX, dateKey: dateKey, score: score, matchedStations: matchedStations, leaderboardSubmitted: leaderboardSubmitted });
}

async function plantFallbackEntry(page, dateKey, docId, alias, score, submittedAt) {
  await page.evaluate(function (args) {
    var key = 'metrordle:leaderboard-fallback:' + args.collection + ':' + args.dateKey;
    var entries = JSON.parse(localStorage.getItem(key) || '{}');
    entries[args.docId] = { alias: args.alias, score: args.score, submittedAt: args.submittedAt };
    localStorage.setItem(key, JSON.stringify(entries));
  }, { collection: FALLBACK_COLLECTION, dateKey: dateKey, docId: docId, alias: alias, score: score, submittedAt: submittedAt });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('shows the alias input when none is saved, and saving it persists site-wide and submits to the local fallback', async () => {
    const DATE = '2026-11-01';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 3, ['Insurgentes', 'Zapata', 'Normal']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'reveal should show for the planted saved result');

      const inputVisible = await page.locator('#leaderboard-alias-row input').isVisible();
      assert.strictEqual(inputVisible, true, 'should show the alias input when no alias is saved');

      await page.fill('#leaderboard-alias-row input', 'Eduardo');
      await page.click('#leaderboard-alias-row button');
      await page.waitForTimeout(300);

      const displayText = await page.$eval('#leaderboard-alias-row', (el) => el.textContent);
      assert.ok(displayText.includes('Eduardo'), 'should show the saved alias, got: ' + displayText);

      // No way to change it once set - changing would land under a
      // different Firestore doc, orphaning the old entry instead of
      // updating it (see the code comment on renderAliasRow).
      const changeButtonCount = await page.locator('#leaderboard-alias-row button').count();
      assert.strictEqual(changeButtonCount, 0, 'should not offer a way to change the alias once set');

      // Site-wide key, not staging-specific - so the same alias carries
      // over to the real page (and any future leaderboard) too.
      const storedKey = await page.evaluate(() => localStorage.getItem('metrordle:alias'));
      assert.strictEqual(storedKey, 'Eduardo');

      // Saving the alias while a result is already showing should have
      // submitted it to the local fallback - confirm it actually landed.
      const fallbackRaw = await page.evaluate((args) => localStorage.getItem('metrordle:leaderboard-fallback:' + args.collection + ':' + args.dateKey), { collection: FALLBACK_COLLECTION, dateKey: DATE });
      assert.ok(fallbackRaw, 'expected a fallback entry to have been written');
      const fallbackEntries = JSON.parse(fallbackRaw);
      assert.strictEqual(fallbackEntries.eduardo.alias, 'Eduardo');
      assert.strictEqual(fallbackEntries.eduardo.score, 3);

      // ...and that it shows up rendered in the leaderboard list itself.
      const rowText = await page.$eval('#leaderboard-list', (el) => el.textContent);
      assert.ok(rowText.includes('Eduardo'), 'submitted score should appear in the rendered leaderboard: ' + rowText);
      assert.ok(rowText.includes('3'), 'rendered leaderboard should show the score: ' + rowText);

      const titleText = await page.$eval('.leaderboard__title', (el) => el.textContent);
      assert.strictEqual(titleText, 'Mejores 5 puntajes hoy');

      // The leaderboard section should render above the matched-station
      // icons, not below.
      const order = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#leaderboard, #reveal-icons'));
        return nodes.map((n) => n.id);
      });
      assert.deepStrictEqual(order, ['leaderboard', 'reveal-icons'], 'leaderboard should come before the icons grid in the DOM');

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
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
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

  test('the local fallback ranks multiple entries by score, tie-broken by earliest submission', async () => {
    const DATE = '2026-11-03';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });

      // Plant three "other players'" fallback entries directly, out of
      // rank order, to prove getTopLeaderboardScoresFallback actually
      // sorts rather than just echoing insertion order.
      await plantFallbackEntry(page, DATE, 'bajo', 'Bajo', 2, 1000);
      await plantFallbackEntry(page, DATE, 'alto', 'Alto', 9, 2000);
      await plantFallbackEntry(page, DATE, 'medio', 'Medio', 5, 500);

      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Yo'));
      await plantSavedResult(page, DATE, 5, ['Insurgentes']); // ties Medio's score

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const rows = await page.$$eval('#leaderboard-list .leaderboard__row', (els) =>
        els.map((el) => ({
          alias: el.querySelector('.leaderboard__alias-name').textContent,
          score: el.querySelector('.leaderboard__score').textContent,
          isYou: el.classList.contains('leaderboard__row--you'),
        }))
      );

      assert.strictEqual(rows.length, 4, 'expected all 4 entries (3 planted + this player) to render');
      // Alto (9) first, then the score-5 tie broken by earlier
      // submittedAt (Medio at 500 before "Yo" at whatever Date.now() is
      // when this test ran, which is far later), then Bajo (2) last.
      assert.strictEqual(rows[0].alias, 'Alto');
      assert.strictEqual(rows[0].score, '9');
      assert.strictEqual(rows[1].alias, 'Medio');
      assert.strictEqual(rows[1].score, '5');
      assert.strictEqual(rows[2].alias, 'Yo');
      assert.strictEqual(rows[2].score, '5');
      assert.strictEqual(rows[2].isYou, true, 'the current player\'s own row should be highlighted');
      assert.strictEqual(rows[3].alias, 'Bajo');
      assert.strictEqual(rows[3].score, '2');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('the leaderboard section shows an empty state before any submission that day', async () => {
    const DATE = '2026-11-04';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      // No alias set, so submitScore() no-ops (see memoria-leaderboard/
      // index.html) - the fallback stays empty for this date.
      await plantSavedResult(page, DATE, 2, ['Insurgentes', 'Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const statusVisible = await page.locator('#leaderboard-status').isVisible();
      assert.strictEqual(statusVisible, true, 'expected the empty-state leaderboard message to show');
      const rows = await page.$$('#leaderboard-list .leaderboard__row');
      assert.strictEqual(rows.length, 0, 'expected no leaderboard rows before any submission');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a reload of an already-submitted day does not resubmit to the leaderboard', async () => {
    const DATE = '2026-11-06';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Ya'));

      // Plant a fallback entry as if an earlier submission already landed
      // with score 7, then plant a saved result with leaderboardSubmitted:
      // true but a *different* score (99) - a state that can't happen for
      // real, used purely to detect a resubmission: if submitScore() ran
      // again despite the flag, it would upsert the fallback entry to 99.
      await plantFallbackEntry(page, DATE, 'ya', 'Ya', 7, 1000);
      await plantSavedResult(page, DATE, 99, ['Insurgentes'], true);

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const fallbackRaw = await page.evaluate((args) => localStorage.getItem('metrordle:leaderboard-fallback:' + args.collection + ':' + args.dateKey), { collection: FALLBACK_COLLECTION, dateKey: DATE });
      const fallbackEntries = JSON.parse(fallbackRaw);
      assert.strictEqual(fallbackEntries.ya.score, 7, 'a day already marked leaderboardSubmitted should not resubmit and overwrite the existing entry');

      const rowText = await page.$eval('#leaderboard-list', (el) => el.textContent);
      assert.ok(rowText.includes('7'), 'rendered leaderboard should still show the original submitted score: ' + rowText);
      assert.ok(!rowText.includes('99'), 'rendered leaderboard should not show the unsubmitted local score: ' + rowText);

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('playing on staging never touches the real Memoria page\'s storage keys', async () => {
    const DATE = '2026-11-05';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + PAGE_PATH + '?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 4, ['Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const realPageResult = await page.evaluate((d) => localStorage.getItem('memoria:' + d), DATE);
      const realStreak = await page.evaluate(() => localStorage.getItem('memoria:streak'));
      assert.strictEqual(realPageResult, null, 'staging should never write the real page\'s per-day result key');
      assert.strictEqual(realStreak, null, 'staging should never write the real page\'s streak key');
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
