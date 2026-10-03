'use strict';

// Covers buildShareText()/shareResult() on /metroguessr/ - specifically
// that a hint used mid-round shows up in the shared text as its own
// 🪄 line ("Pista: revelar línea" / "Pista: revelar calles"), matching
// the hint button's own live label and the leaderboard's own 🪄-per-hint
// badge. Previously the share text only ever listed state.guesses,
// silently dropping any hint used - a player who solved it with help
// would share a result that looked unassisted. Same native-share-stub
// trick as memoria/share.test.js (Playwright's Chromium has no
// navigator.share by default), and the same fabricated-guesses-planted-
// in-localStorage trick as this page's own leaderboard.test.js to reach
// the reveal screen instantly instead of actually guessing the day's
// real target.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap } = require('../lib/metroguessr-helpers');

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

  test('a round with one hint used adds a single "🪄 Pista: revelar línea" line to the shared text', async () => {
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

  test('a round with both hints used adds both "revelar línea" and "revelar calles" lines, in that order', async () => {
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

  const failed = await runAll();
  await browser.close();
  server.stop();
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
