'use strict';

// Covers a bug found right after /configurar/ shipped: the map tile
// style was picked by querying prefers-color-scheme directly
// (prefersDark() in metroguessr/index.html), completely bypassing an
// explicit light/dark override saved on /configurar/ - every other
// piece of this page's own styling follows shared.css's [data-theme]
// rules, but the map tiles kept following the OS setting regardless,
// producing a page with (say) light chrome and dark tiles. Fixed by
// having prefersDark() check MetroShared.getThemeMode() first and only
// fall back to the OS preference for 'system'. See leaflet-stub.js's
// own maplibreGL() stub for how the chosen style URL is captured
// (window.__mgLastGlStyle) without needing real tiles to render.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap } = require('../lib/metroguessr-helpers');

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

async function loadWithMode(browser, server, mode, osColorScheme) {
  const context = await browser.newContext({ viewport: { width: 400, height: 800 }, colorScheme: osColorScheme });
  const page = await context.newPage();
  await stubMap(page);
  if (mode) {
    await page.addInitScript((m) => {
      localStorage.setItem('metrordle:config', JSON.stringify({ mode: m }));
    }, mode);
  }
  await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=2026-11-22', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const style = await page.evaluate(() => window.__mgLastGlStyle);
  await context.close();
  return style;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('an explicit "Claro" override picks the light tile style even when the OS is dark', async () => {
    const style = await loadWithMode(browser, server, 'light', 'dark');
    assert.strictEqual(style, STYLE_LIGHT);
  });

  test('an explicit "Oscuro" override picks the dark tile style even when the OS is light', async () => {
    const style = await loadWithMode(browser, server, 'dark', 'light');
    assert.strictEqual(style, STYLE_DARK);
  });

  test('"Sistema" still follows the OS preference, dark', async () => {
    const style = await loadWithMode(browser, server, 'system', 'dark');
    assert.strictEqual(style, STYLE_DARK);
  });

  test('no saved config at all still follows the OS preference, light', async () => {
    const style = await loadWithMode(browser, server, null, 'light');
    assert.strictEqual(style, STYLE_LIGHT);
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
