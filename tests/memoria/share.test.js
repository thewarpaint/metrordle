'use strict';

// Covers the "Compartir" button's two paths on the real /memoria/ page:
// the native Web Share API when available (see shareResult() in
// memoria/index.html), and the clipboard-copy fallback otherwise. The
// clipboard path is already covered end to end in round-lifecycle.test.js
// via a real completed round - this file uses the saved-result-planted-
// in-localStorage trick (see memoria-leaderboard's tests) to reach the
// reveal screen instantly instead, and focuses on the native-share branch
// specifically, since Playwright's Chromium has no navigator.share by
// default and so never exercises it otherwise.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function plantSavedResult(page, dateKey, score, matchedStations) {
  await page.evaluate(function (args) {
    localStorage.setItem('memoria:' + args.dateKey, JSON.stringify({
      score: args.score,
      won: args.score >= 8,
      matchedStations: args.matchedStations,
      leaderboardSubmitted: true,
    }));
  }, { dateKey: dateKey, score: score, matchedStations: matchedStations });
}

// Installed before any page script runs, so navigator.share exists by
// the time shareResult() checks for it. Records what it was called with
// on window.__shareCalls for the test to inspect.
async function stubNativeShare(page, options) {
  await page.addInitScript(function (opts) {
    window.__shareCalls = [];
    navigator.share = function (data) {
      window.__shareCalls.push(data);
      if (opts && opts.reject) {
        var err = new Error(opts.rejectMessage || 'share failed');
        if (opts.rejectName) err.name = opts.rejectName;
        return Promise.reject(err);
      }
      return Promise.resolve();
    };
  }, options || {});
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the share button uses navigator.share with the built share text when available', async () => {
    const DATE = '2026-12-10';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubNativeShare(page);
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 4, ['Zapata', 'Insurgentes']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      await page.click('#share-btn');
      await page.waitForTimeout(200);

      const calls = await page.evaluate(() => window.__shareCalls);
      assert.strictEqual(calls.length, 1, 'expected navigator.share to be called exactly once');
      assert.ok(calls[0].text.startsWith('#Metrordle: Memoria #'), 'shared text should start with the game header, got: ' + calls[0].text);
      assert.ok(calls[0].text.includes('Parejas: 4'), 'shared text should include the score, got: ' + calls[0].text);
      assert.ok(calls[0].text.includes('https://metrordle.com/memoria/'), 'shared text should include the game URL, got: ' + calls[0].text);

      // The native share sheet is the OS's own confirmation UI - the
      // button shouldn't also flash the clipboard-copy label.
      const btnLabel = await page.$eval('#share-btn', (el) => el.textContent);
      assert.strictEqual(btnLabel, 'Compartir', 'button label should stay unchanged on the native-share path');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('falls back to clipboard copy when the player cancels the native share sheet', async () => {
    const DATE = '2026-12-11';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubNativeShare(page, { reject: true, rejectName: 'AbortError' });
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 2, ['Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      await page.click('#share-btn');
      await page.waitForTimeout(300);

      // A cancelled share sheet (AbortError) isn't a failure to recover
      // from - it should NOT also fall back to a clipboard copy (which
      // would flash the button label to "¡Copiado!").
      const btnLabel = await page.$eval('#share-btn', (el) => el.textContent);
      assert.strictEqual(btnLabel, 'Compartir', 'a cancelled share should not trigger the clipboard-copy fallback');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('falls back to clipboard copy when the native share sheet fails for another reason', async () => {
    const DATE = '2026-12-12';
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubNativeShare(page, { reject: true, rejectName: 'NotAllowedError' });
      await page.goto(server.baseUrl + '/memoria/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await plantSavedResult(page, DATE, 3, ['Zapata']);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      await page.click('#share-btn');
      await page.waitForTimeout(300);

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(clipboardText.startsWith('#Metrordle: Memoria #'), 'expected the share text on the clipboard after a non-abort share failure, got: ' + clipboardText);

      const btnLabel = await page.$eval('#share-btn', (el) => el.textContent);
      assert.strictEqual(btnLabel, '¡Copiado!', 'button should show the clipboard-copy confirmation on this fallback path');

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
