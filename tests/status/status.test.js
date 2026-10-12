'use strict';

// Covers /status/, the read-only ops health check (see AGENTS.md's own
// bullet for it): the cache-version readout (caches.keys()) and the
// two live checks (/healthcheck.json, a real Firestore read of
// records/memoria), each rendered as a green .notice--success or red
// .notice--error with its own measured latency.
//
// This sandboxed test environment serves /healthcheck.json itself (the
// local static server - see tests/lib/harness.js - roots at the repo,
// same as every real page's own absolute paths), so that check
// genuinely goes green here. Firestore is unreachable (gstatic.com is
// blocked - same as every other leaderboard test), so the Firebase SDK
// itself never loads and that check goes red with "SDK no disponible" -
// this file isn't testing a real Firestore round trip, just that a
// failure to initialize renders correctly instead of hanging forever.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('shows no cache yet on a fresh visit, a green healthcheck result, and a red Firebase result (SDK unreachable)', async () => {
    // serviceWorkers: 'block' keeps this test's cache-info assertion
    // deterministic - otherwise a real SW install racing the page's
    // own caches.keys() read could populate Cache Storage mid-test.
    const context = await browser.newContext({ viewport: { width: 420, height: 700 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(server.baseUrl + '/status/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const cacheInfo = await page.locator('#cache-info').textContent();
      assert.ok(cacheInfo.indexOf('Sin caché activa todavía') !== -1, 'expected no active cache with the service worker blocked: ' + cacheInfo);

      const healthClass = await page.locator('#healthcheck-notice').getAttribute('class');
      assert.ok(healthClass.indexOf('notice--success') !== -1, 'expected the healthcheck check to go green: ' + healthClass);
      const healthText = await page.locator('#healthcheck-notice').textContent();
      assert.ok(/healthcheck\.json respondió "ok" en \d+ ms/.test(healthText), 'expected an "ok" result with a latency in ms: ' + healthText);

      const firebaseClass = await page.locator('#firebase-notice').getAttribute('class');
      assert.ok(firebaseClass.indexOf('notice--error') !== -1, 'expected the Firebase check to go red with no reachable Firestore: ' + firebaseClass);
      const firebaseText = await page.locator('#firebase-notice').textContent();
      assert.ok(firebaseText.indexOf('SDK no disponible') !== -1, 'expected a clear SDK-unavailable reason, not a hang: ' + firebaseText);

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('"Volver a comprobar" re-runs both checks from a checking state', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/status/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Delays the healthcheck response just for this click, so the
      // transient "checking" state is observable instead of racing a
      // same-origin fetch that would otherwise resolve before the next
      // Playwright round trip can read the DOM.
      await page.route('**/healthcheck.json*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.continue();
      });

      await page.click('#recheck-btn');
      const checkingClass = await page.locator('#healthcheck-notice').getAttribute('class');
      assert.ok(checkingClass.indexOf('notice--info') !== -1, 'expected a neutral "checking" state right after clicking: ' + checkingClass);

      await page.waitForTimeout(700);
      const healthClass = await page.locator('#healthcheck-notice').getAttribute('class');
      assert.ok(healthClass.indexOf('notice--success') !== -1, 'expected the healthcheck check to resolve green again: ' + healthClass);
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
