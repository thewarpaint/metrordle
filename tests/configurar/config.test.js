'use strict';

// Covers /configurar/, the site-wide settings page - for now just the
// light/dark/system appearance picker (see AGENTS.md's "Site config"
// section and shared.js's loadConfig()/saveConfig()/getThemeMode()/
// applyThemeMode()/setThemeMode()). The whole mechanism hinges on one
// localStorage key ('metrordle:config') holding a plain object that's
// meant to grow more settings later, and on shared.css's own
// [data-theme] rules (present but unused before this page existed) -
// this file checks both the picker's own UI state and that the choice
// actually reaches <html>'s data-theme attribute, on this page and on
// another page entirely, not just that something gets written to
// localStorage.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function getConfig(page) {
  return page.evaluate(() => {
    var raw = localStorage.getItem('metrordle:config');
    return raw ? JSON.parse(raw) : null;
  });
}

async function getDataTheme(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

async function getPressedStates(page) {
  return page.evaluate(() => {
    var result = {};
    ['light', 'dark', 'system'].forEach(function (mode) {
      result[mode] = document.getElementById('theme-option-' + mode).getAttribute('aria-pressed');
    });
    return result;
  });
}

async function getDataReducedMotion(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-reduced-motion'));
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('with no saved config, "Sistema" shows selected and no data-theme override is applied', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      assert.deepStrictEqual(await getPressedStates(page), { light: 'false', dark: 'false', system: 'true' });
      assert.strictEqual(await getDataTheme(page), null);
    } finally {
      await context.close();
    }
  });

  test('picking "Oscuro" persists mode:dark and applies data-theme="dark" immediately, no reload', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#theme-option-dark');

      assert.deepStrictEqual(await getConfig(page), { mode: 'dark' });
      assert.strictEqual(await getDataTheme(page), 'dark');
      assert.deepStrictEqual(await getPressedStates(page), { light: 'false', dark: 'true', system: 'false' });
    } finally {
      await context.close();
    }
  });

  test('picking "Claro" then "Sistema" persists each choice and clears the override on "Sistema"', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#theme-option-light');
      assert.deepStrictEqual(await getConfig(page), { mode: 'light' });
      assert.strictEqual(await getDataTheme(page), 'light');

      await page.click('#theme-option-system');
      assert.deepStrictEqual(await getConfig(page), { mode: 'system' });
      assert.strictEqual(await getDataTheme(page), null, '"Sistema" should remove the data-theme override entirely');
    } finally {
      await context.close();
    }
  });

  test('a saved mode survives a reload and is applied before shared.js even runs', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.click('#theme-option-dark');

      await page.reload({ waitUntil: 'domcontentloaded' });
      // domcontentloaded fires after the <head> inline script has run
      // but before shared.js (loaded at the end of <body>) - this is
      // exactly the flash-prevention snippet earning its keep, not
      // shared.js's own safety-net re-application.
      assert.strictEqual(await getDataTheme(page), 'dark');

      await page.waitForLoadState('networkidle');
      assert.deepStrictEqual(await getPressedStates(page), { light: 'false', dark: 'true', system: 'false' });
    } finally {
      await context.close();
    }
  });

  test('a mode saved on /configurar/ also applies on another page entirely (site-wide, not page-local)', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.click('#theme-option-dark');

      await page.goto(server.baseUrl + '/?debug=true', { waitUntil: 'domcontentloaded' });
      assert.strictEqual(await getDataTheme(page), 'dark', 'the index page\'s own <head> snippet should apply the same saved mode');
    } finally {
      await context.close();
    }
  });

  test('saving a mode merges into (rather than replacing) an existing config object', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        localStorage.setItem('metrordle:config', JSON.stringify({ someFutureSetting: 'keepme' }));
      });

      await page.click('#theme-option-dark');

      assert.deepStrictEqual(await getConfig(page), { someFutureSetting: 'keepme', mode: 'dark' });
    } finally {
      await context.close();
    }
  });

  test('with no saved config, the "Animaciones limitadas" toggle shows off and applies no override', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      assert.strictEqual(await page.locator('#reduced-motion-option').getAttribute('aria-pressed'), 'false');
      assert.strictEqual(await getDataReducedMotion(page), null);
    } finally {
      await context.close();
    }
  });

  test('turning on "Animaciones limitadas" persists it, applies data-reduced-motion immediately (no reload), and MetroShared.prefersReducedMotion() picks it up', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#reduced-motion-option');

      assert.deepStrictEqual(await getConfig(page), { reducedMotion: true });
      assert.strictEqual(await getDataReducedMotion(page), 'true');
      assert.strictEqual(await page.locator('#reduced-motion-option').getAttribute('aria-pressed'), 'true');

      // This is the one function every game's own animation timing
      // (each page's own delay() helper, or a live check like Metro
      // Crush's collapseBoard()) actually calls - the setting is only
      // real once this reflects it, independently of the OS media
      // query (this sandboxed browser has no OS-level override of its
      // own, so a bare true here can only have come from the app
      // setting).
      assert.strictEqual(await page.evaluate(() => MetroShared.prefersReducedMotion()), true);

      await page.click('#reduced-motion-option');
      assert.deepStrictEqual(await getConfig(page), { reducedMotion: false });
      assert.strictEqual(await getDataReducedMotion(page), null, 'turning it back off should remove the attribute entirely, not set it to "false"');
      assert.strictEqual(await page.evaluate(() => MetroShared.prefersReducedMotion()), false);
    } finally {
      await context.close();
    }
  });

  test('a saved "Animaciones limitadas" choice survives a reload and applies on another page entirely', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.click('#reduced-motion-option');

      await page.reload({ waitUntil: 'networkidle' });
      assert.strictEqual(await getDataReducedMotion(page), 'true', 'should still be applied after a reload (via shared.js\'s own call at load, there\'s no pre-paint snippet needed for this one)');
      assert.strictEqual(await page.locator('#reduced-motion-option').getAttribute('aria-pressed'), 'true');

      await page.goto(server.baseUrl + '/metrocrush/?date=2027-05-10', { waitUntil: 'networkidle' });
      assert.strictEqual(await getDataReducedMotion(page), 'true', 'should apply site-wide, not just on /configurar/ itself');
    } finally {
      await context.close();
    }
  });

  test('turning on "Animaciones limitadas" merges into (rather than replacing) an existing config object, and vice versa with the theme mode', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#theme-option-dark');
      await page.click('#reduced-motion-option');
      assert.deepStrictEqual(await getConfig(page), { mode: 'dark', reducedMotion: true });

      await page.click('#theme-option-light');
      assert.deepStrictEqual(await getConfig(page), { mode: 'light', reducedMotion: true }, 'changing the theme afterward should not clear the reduced-motion choice');
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
