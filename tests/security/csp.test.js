'use strict';

// Guards the site's Content-Security-Policy (see the <meta
// http-equiv="Content-Security-Policy"> tag + its explanatory comment at
// the top of each page's <head>) against two failure modes:
//
// 1. A policy that's too strict and silently breaks the page itself
//    (blocks its own inline <script>, the embedded font, or the Firebase
//    SDK) - checked by loading every page and asserting zero
//    `securitypolicyviolation` events and zero page errors.
// 2. A policy that LOOKS present in the HTML but isn't actually
//    enforced (a typo in the meta tag, wrong http-equiv casing, etc.) -
//    checked with a positive control: a fetch() and a <script src> to a
//    host that's deliberately not on the allowlist must both be
//    blocked. Without this check, a broken/no-op CSP would pass check 1
//    trivially (nothing to violate if nothing is enforced).
//
// This is defense-in-depth, not the app's actual XSS mitigation (every
// leaderboard alias render uses textContent, never innerHTML - see
// tests/*/leaderboard.test.js and the CSP meta tag's own comment for
// why 'unsafe-inline' is still needed on script-src/style-src here).
//
// Unlike every other page here, /metroguessr/'s own script-src/
// connect-src/worker-src allowlist a handful of real third-party hosts
// it needs to actually function (Leaflet/MapLibre/OpenFreeMap tiles -
// see its own CSP comment) rather than just Firebase's - if those hosts
// are unreachable (as in a network-restricted CI runner), the page
// itself fails to load (`L is not defined`), which check 1 above would
// wrongly report as a CSP problem. This test doesn't special-case that;
// it's the same tradeoff already accepted for Firebase everywhere else
// in this file (a real player whose network blocks Firebase gets a
// working page anyway, since that dependency is optional - Metroguessr's
// map isn't). Run this file somewhere with real internet access to get
// a meaningful result for /metroguessr/ specifically.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

const PAGES = ['/', '/memoria/', '/laberinto/', '/metroguessr/', '/metrocrush/', '/admin/', '/purge/'];

async function collectCspViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blockedURI: e.blockedURI });
    });
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('every page loads under its own CSP with zero policy violations', async () => {
    const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
    try {
      for (const path of PAGES) {
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        await collectCspViolations(page);

        await page.goto(server.baseUrl + path + '?debug=true', { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const violations = await page.evaluate(() => window.__cspViolations);
        assert.deepStrictEqual(violations, [], path + ' should load with no CSP violations: ' + JSON.stringify(violations));
        assert.deepStrictEqual(pageErrors, [], path + ' should load with no page errors: ' + JSON.stringify(pageErrors));

        await page.close();
      }
    } finally {
      await context.close();
    }
  });

  test('the CSP is actually enforced (positive control): a disallowed fetch() and <script src> are both blocked', async () => {
    const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/?debug=true', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const fetchBlocked = await page.evaluate(async () => {
        try {
          await fetch('https://example.com/');
          return false;
        } catch (e) {
          return true;
        }
      });
      assert.strictEqual(fetchBlocked, true, 'connect-src should block a fetch() to a non-allowlisted host');

      const scriptBlocked = await page.evaluate(() => {
        return new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = 'https://example.com/does-not-matter.js';
          s.onload = () => resolve(false);
          s.onerror = () => resolve(true);
          document.head.appendChild(s);
          setTimeout(() => resolve(false), 2000);
        });
      });
      assert.strictEqual(scriptBlocked, true, 'script-src should block a <script src> from a non-allowlisted host');
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
