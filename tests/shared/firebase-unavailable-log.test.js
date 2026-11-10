'use strict';

// When the Firebase SDK never loaded (an ad blocker, a firewall, or
// gstatic.com being unreachable - which is also this sandbox's own default,
// since it can't reach gstatic), a leaderboard read/write must log WHY in
// the console, not just a generic "Firebase not ready". That reason is the
// only breadcrumb for diagnosing a player whose scores silently never
// submit (see the reported firebaseDefined:false bug).

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

// Polls captured console lines for a match (the probe logs asynchronously
// once its fetch settles), failing with the collected lines if none arrives.
async function waitForLog(lines, regex, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (lines.some(function (l) { return regex.test(l); })) return;
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  throw new Error('no console line matched ' + regex + ' within ' + timeoutMs + 'ms; got: ' + JSON.stringify(lines));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('a leaderboard read with the SDK unavailable logs the reason', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const warnings = [];
    page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
    try {
      // Block the vendored SDK so `firebase` stays undefined and
      // getTopLeaderboardScores() hits its "Firebase not ready" branch,
      // which logs the reason synchronously.
      await page.route('**/vendor/firebase/**', (route) => route.abort());
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        window.MetroShared.getTopLeaderboardScores('memoria-leaderboard', '2026-11-20', 5, [['score', 'desc']], {});
      });
      await page.waitForTimeout(100);

      const reasonLog = warnings.find(function (w) {
        return /Firebase not ready/.test(w) && /(vendored|same-origin|service-worker cache)/.test(w);
      });
      assert.ok(reasonLog, 'expected a Firebase-not-ready warning naming the cause, got: ' + JSON.stringify(warnings));
    } finally {
      await context.close();
    }
  });

  test('SDK probe: a blocked request logs that NO HTTP status exists (ad blocker shape)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    try {
      // Abort the SDK request: `firebase` stays undefined AND the probe's own
      // re-fetch is blocked - exactly the ad-blocker/firewall shape.
      await page.route('**/firebase-app-compat.js', (route) => route.abort());
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await waitForLog(errors, /SDK probe:.*FAILED.*no HTTP status exists/);
    } finally {
      await context.close();
    }
  });

  test('SDK probe: a reachable-but-erroring SDK logs the exact HTTP status', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    try {
      // Serve a CORS-enabled 503 (like gstatic): the <script> won't execute an
      // error status, so `firebase` stays undefined and the probe's cors fetch
      // reads the real status back.
      await page.route('**/firebase-app-compat.js', (route) => route.fulfill({
        status: 503,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/javascript',
        body: '',
      }));
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await waitForLog(errors, /SDK probe:.*HTTP status 503/);
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
