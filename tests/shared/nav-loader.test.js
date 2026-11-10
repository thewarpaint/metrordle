'use strict';

// Covers shared.js's initNavLoader (#2 in docs/navigation-loader.md): a
// same-origin nav-link click shows a thin top progress bar ~150ms in, so a
// slow/uncached full-page load gives feedback; an in-page (hash) link does
// not. The destination is delayed via page.route so the outgoing page - the
// one that carries the bar - stays alive and queryable instead of being
// replaced. (#1, the CSS @view-transition fade, is progressive enhancement
// with nothing to assert here.)

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('a same-origin nav-link click shows the top progress bar after the delay', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.credit a[href="/tablero/"]'); // rendered by initFooter
      // Cancel the real navigation so the page stays queryable. This capture
      // listener is registered AFTER initNavLoader's, so initNavLoader still
      // sees the (not-yet-prevented) click and starts the bar; we only stop
      // the actual page load.
      await page.evaluate(() => {
        document.addEventListener('click', function (e) {
          var a = e.target.closest && e.target.closest('a[href]');
          if (a) e.preventDefault();
        }, true);
      });

      assert.strictEqual(await page.locator('.nav-loader--active').count(), 0, 'no bar before any navigation');
      await page.click('.credit a[href="/tablero/"]', { noWaitAfter: true });
      await page.waitForSelector('.nav-loader--active', { timeout: 2000 });
      assert.strictEqual(await page.locator('.nav-loader').isVisible(), true, 'the bar is visible once a navigation starts');
    } finally {
      await context.close();
    }
  });

  test('an in-page hash link does not show the bar', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/memoria/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.credit');
      await page.evaluate(() => {
        var a = document.createElement('a');
        a.id = 'in-page-link';
        a.href = '#somewhere';
        a.textContent = 'anchor';
        document.body.appendChild(a);
      });
      await page.click('#in-page-link', { noWaitAfter: true });
      await page.waitForTimeout(300); // past the 150ms delay
      assert.strictEqual(await page.locator('.nav-loader--active').count(), 0, 'a same-page hash link must not trigger the loader');
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
