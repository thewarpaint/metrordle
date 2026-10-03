'use strict';

// Covers buildShareText()/shareResult() on /metroguessr/ - specifically
// that a hint used mid-round shows up in the shared text as its own
// 🪄 line ("Pista: revelar línea" / "Pista: revelar calles"), matching
// the hint button's own live label and the leaderboard's own 🪄-per-hint
// badge. Previously the share text only ever listed state.guesses,
// silently dropping any hint used - a player who solved it with help
// would share a result that looked unassisted.
//
// Fixed in two steps, both covered here: first by always appending
// hint lines after every guess line regardless of when the hint was
// actually used, then (this file's own later tests) by recording the
// REAL chronological order in a new state.timeline array - guess and
// hint entries interleaved exactly as they happened - and walking that
// instead. plantState() below still plants the pre-timeline shape (no
// `timeline` field at all), which doubles as coverage for
// synthesizeTimeline()'s own backward-compatibility fallback for a
// round saved by an older version of this page: it's the same
// guesses-then-hints order the share text always showed before
// state.timeline existed, so an old in-progress/done save doesn't
// change how it displays just from loading it under a newer version.
//
// Same native-share-stub trick as memoria/share.test.js (Playwright's
// Chromium has no navigator.share by default), and the same
// fabricated-guesses-planted-in-localStorage trick as this page's own
// leaderboard.test.js to reach the reveal screen instantly instead of
// actually guessing the day's real target, for the plantState() tests.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap, guess, FILLER_GUESSES, playToReveal, revealedTarget } = require('../lib/metroguessr-helpers');

async function plantState(page, dateKey, guesses, hintsUsed) {
  await page.evaluate((args) => {
    localStorage.setItem('metroguessr:' + args.dateKey, JSON.stringify({
      guesses: args.guesses,
      hintsUsed: args.hintsUsed,
      done: true,
      leaderboardSubmitted: true,
    }));
  }, { dateKey, guesses, hintsUsed });
}

async function stubNativeShare(page) {
  await page.addInitScript(() => {
    window.__shareCalls = [];
    navigator.share = function (data) {
      window.__shareCalls.push(data);
      return Promise.resolve();
    };
  });
}

async function getSharedText(page) {
  await page.click('#share-btn');
  await page.waitForTimeout(200);
  const calls = await page.evaluate(() => window.__shareCalls);
  assert.strictEqual(calls.length, 1, 'expected navigator.share to be called exactly once');
  return calls[0].text;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('a legacy save (no state.timeline) with one hint used falls back to a single "🪄 Pista: revelar línea" line after the guesses', async () => {
    const DATE = '2027-06-01';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await stubNativeShare(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantState(page, DATE, [
        { name: 'Zócalo', dist: 3.2, correct: false },
        { name: 'Chapultepec', dist: 0, correct: true },
      ], 1);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const text = await getSharedText(page);
      const lines = text.split('\n');
      assert.ok(lines.includes('🪄 Pista: revelar línea'), 'expected the hint line, got:\n' + text);
      assert.ok(!text.includes('revelar calles'), 'only one hint was used - the second hint line should not appear, got:\n' + text);

      // Guess lines first, hint line after - and the total line count
      // should match attempts (2 guesses + 1 hint = 3), same invariant
      // buildShareText()'s own comment documents.
      const hintLineIndex = lines.indexOf('🪄 Pista: revelar línea');
      const bullseyeIndex = lines.indexOf('🎯');
      assert.ok(bullseyeIndex !== -1 && bullseyeIndex < hintLineIndex, 'guess lines should come before the hint line');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a legacy save (no state.timeline) with both hints used falls back to both lines after the guesses, in order', async () => {
    const DATE = '2027-06-02';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await stubNativeShare(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantState(page, DATE, [
        { name: 'Zócalo', dist: 3.2, correct: false },
        { name: 'Pantitlán', dist: 7.1, correct: false },
        { name: 'Chapultepec', dist: 0, correct: true },
      ], 2);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const text = await getSharedText(page);
      const lines = text.split('\n');
      const lineIdx = lines.indexOf('🪄 Pista: revelar línea');
      const streetsIdx = lines.indexOf('🪄 Pista: revelar calles');
      assert.ok(lineIdx !== -1, 'expected the "revelar línea" hint line, got:\n' + text);
      assert.ok(streetsIdx !== -1, 'expected the "revelar calles" hint line, got:\n' + text);
      assert.ok(lineIdx < streetsIdx, 'the line hint should be listed before the streets hint');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('a round with no hints used adds no 🪄 lines at all', async () => {
    const DATE = '2027-06-03';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await stubNativeShare(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantState(page, DATE, [
        { name: 'Chapultepec', dist: 0, correct: true },
      ], 0);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const text = await getSharedText(page);
      assert.ok(!text.includes('🪄'), 'no hint was used - expected no 🪄 line at all, got:\n' + text);

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('hints interleaved between real guesses appear in the shared text in the order they actually happened, not bunched at the end', async () => {
    const DATE = '2027-06-04';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const throwawayContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
      const throwaway = await throwawayContext.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwawayContext.close();
      const wrongGuesses = FILLER_GUESSES.filter((name) => name !== target);

      await stubMap(page);
      await stubNativeShare(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });

      // Guess, hint, guess, hint, guess (3 wrong guesses + 2 hints = 5,
      // the round's cap) - deliberately alternating rather than all
      // guesses then all hints, the one order the old (pre-timeline)
      // behavior could never produce correctly.
      await guess(page, wrongGuesses[0]);
      await page.click('#hint-btn');
      await page.waitForTimeout(80);
      await guess(page, wrongGuesses[1]);
      await page.click('#hint-btn');
      await page.waitForTimeout(80);
      await guess(page, wrongGuesses[2]);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'the fifth attempt should have ended the round');

      const text = await getSharedText(page);
      const lines = text.split('\n');
      const kinds = lines.map((line) => {
        if (line === '🪄 Pista: revelar línea' || line === '🪄 Pista: revelar calles') return 'hint';
        if (line.startsWith('🟦') || line.startsWith('🟩') || line.startsWith('🟨') || line.startsWith('🟧') || line.startsWith('🟥') || line === '🎯') return 'guess';
        return null;
      }).filter((k) => k !== null);

      assert.deepStrictEqual(kinds, ['guess', 'hint', 'guess', 'hint', 'guess'], 'expected the real play order preserved in the shared text, got:\n' + text);

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('the interleaved order survives a reload mid-round', async () => {
    const DATE = '2027-06-05';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const throwawayContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
      const throwaway = await throwawayContext.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwawayContext.close();
      const wrongGuesses = FILLER_GUESSES.filter((name) => name !== target);

      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });

      // Hint first (allowed once there's at least one guess), then a
      // second guess - so the saved timeline has to actually record
      // [guess, hint, guess], not just a count of each.
      await guess(page, wrongGuesses[0]);
      await page.click('#hint-btn');
      await page.waitForTimeout(80);
      await guess(page, wrongGuesses[1]);

      const timelineBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('metroguessr:' + '2027-06-05')).timeline.map((e) => e.kind));
      assert.deepStrictEqual(timelineBefore, ['guess', 'hint', 'guess'], 'expected the real order persisted before any reload');

      await stubNativeShare(page);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const timelineAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('metroguessr:' + '2027-06-05')).timeline.map((e) => e.kind));
      assert.deepStrictEqual(timelineAfter, ['guess', 'hint', 'guess'], 'expected the same order still there after reload');

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
