'use strict';

// Covers /configurar/, the site-wide settings page: the light/dark/
// system appearance picker and the reduced-motion picker (see AGENTS.md's
// "Site config" section and shared.js's loadConfig()/saveConfig()/
// getThemeMode()/applyThemeMode()/setThemeMode()). Those two hinge on one
// localStorage key ('metrordle:config') holding a plain object that's
// meant to grow more settings later, and on shared.css's own
// [data-theme] rules (present but unused before this page existed) -
// this file checks both each picker's own UI state and that the choice
// actually reaches <html>'s data-theme/data-reduced-motion attribute, on
// this page and on another page entirely, not just that something gets
// written to localStorage.
//
// Also covers the alias field (a separate, pre-existing
// 'metrordle:alias' key - see MetroShared.getAlias()/setAlias(), the
// same functions every game's own leaderboard alias row already uses)
// added as this page's third section: pre-fills with the current
// alias, trims on save, and shows a success/error notice. Renaming
// here does NOT move any already-submitted leaderboard entries (the
// alias is the Firestore document ID - see AGENTS.md's "Leaderboards"
// bullet) - this file doesn't re-test that documented limitation
// itself, just that the new field persists/reads MetroShared's alias
// correctly.

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

  test('with no saved config, "Normal" shows selected and no data-reduced-motion override is applied', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      assert.strictEqual(await page.locator('#motion-option-normal').getAttribute('aria-pressed'), 'true', '"Normal" should be the default');
      assert.strictEqual(await page.locator('#motion-option-reduced').getAttribute('aria-pressed'), 'false');
      assert.strictEqual(await getDataReducedMotion(page), null);
    } finally {
      await context.close();
    }
  });

  test('picking "Animaciones limitadas" persists it, applies data-reduced-motion immediately (no reload), and MetroShared.prefersReducedMotion() picks it up', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#motion-option-reduced');

      assert.deepStrictEqual(await getConfig(page), { reducedMotion: true });
      assert.strictEqual(await getDataReducedMotion(page), 'true');
      assert.strictEqual(await page.locator('#motion-option-reduced').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(await page.locator('#motion-option-normal').getAttribute('aria-pressed'), 'false');

      // This is the one function every game's own animation timing
      // (each page's own delay() helper, or a live check like Metro
      // Crush's collapseBoard()) actually calls - the setting is only
      // real once this reflects it, independently of the OS media
      // query (this sandboxed browser has no OS-level override of its
      // own, so a bare true here can only have come from the app
      // setting).
      assert.strictEqual(await page.evaluate(() => MetroShared.prefersReducedMotion()), true);

      await page.click('#motion-option-normal');
      assert.deepStrictEqual(await getConfig(page), { reducedMotion: false });
      assert.strictEqual(await getDataReducedMotion(page), null, 'picking "Normal" should remove the attribute entirely, not set it to "false"');
      assert.strictEqual(await page.locator('#motion-option-normal').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(await page.locator('#motion-option-reduced').getAttribute('aria-pressed'), 'false');
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
      await page.click('#motion-option-reduced');

      await page.reload({ waitUntil: 'networkidle' });
      assert.strictEqual(await getDataReducedMotion(page), 'true', 'should still be applied after a reload (via shared.js\'s own call at load, there\'s no pre-paint snippet needed for this one)');
      assert.strictEqual(await page.locator('#motion-option-reduced').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(await page.locator('#motion-option-normal').getAttribute('aria-pressed'), 'false');

      await page.goto(server.baseUrl + '/metrocrush/?date=2027-05-10', { waitUntil: 'networkidle' });
      assert.strictEqual(await getDataReducedMotion(page), 'true', 'should apply site-wide, not just on /configurar/ itself');
    } finally {
      await context.close();
    }
  });

  test('picking "Animaciones limitadas" merges into (rather than replacing) an existing config object, and vice versa with the theme mode', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.click('#theme-option-dark');
      await page.click('#motion-option-reduced');
      assert.deepStrictEqual(await getConfig(page), { mode: 'dark', reducedMotion: true });

      await page.click('#theme-option-light');
      assert.deepStrictEqual(await getConfig(page), { mode: 'light', reducedMotion: true }, 'changing the theme afterward should not clear the reduced-motion choice');
    } finally {
      await context.close();
    }
  });

  test('with no saved alias, the field starts empty and shows no notice', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      assert.strictEqual(await page.locator('#alias-input').inputValue(), '');
      assert.strictEqual(await page.locator('#alias-notice').isVisible(), false);
    } finally {
      await context.close();
    }
  });

  test('a saved alias pre-fills the field on load', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Eduardo'));

      await page.reload({ waitUntil: 'networkidle' });
      assert.strictEqual(await page.locator('#alias-input').inputValue(), 'Eduardo');
    } finally {
      await context.close();
    }
  });

  test('saving a new alias persists it (trimmed), shows a success notice, and applies site-wide', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.fill('#alias-input', '  Roberto  ');
      await page.click('#alias-save-btn');

      assert.strictEqual(await page.evaluate(() => localStorage.getItem('metrordle:alias')), 'Roberto', 'should trim before saving, same as MetroShared.normalizeAlias()');
      assert.strictEqual(await page.locator('#alias-input').inputValue(), 'Roberto');

      const notice = page.locator('#alias-notice');
      assert.strictEqual(await notice.isVisible(), true);
      assert.ok((await notice.textContent()).includes('Roberto'), 'the success notice should name the alias that was saved');
      assert.strictEqual(await notice.getAttribute('class'), 'alias-notice alias-notice--success');

      // Site-wide, same as the alias every other page's own leaderboard
      // alias row reads via MetroShared.getAlias().
      await page.goto(server.baseUrl + '/clasificador/?debug=true&date=2026-11-19', { waitUntil: 'networkidle' });
      assert.strictEqual(await page.evaluate(() => MetroShared.getAlias()), 'Roberto');
    } finally {
      await context.close();
    }
  });

  test('saving a blank alias shows an error notice and leaves the existing alias untouched', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.setItem('metrordle:alias', 'Eduardo'));
      await page.reload({ waitUntil: 'networkidle' });

      await page.fill('#alias-input', '   ');
      await page.click('#alias-save-btn');

      assert.strictEqual(await page.evaluate(() => localStorage.getItem('metrordle:alias')), 'Eduardo', 'a blank submission should not clear the existing alias');
      const notice = page.locator('#alias-notice');
      assert.strictEqual(await notice.isVisible(), true);
      assert.strictEqual(await notice.getAttribute('class'), 'alias-notice alias-notice--error');
    } finally {
      await context.close();
    }
  });

  test('pressing Enter in the alias field saves it, same as clicking "Guardar"', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      await page.fill('#alias-input', 'Karla');
      await page.locator('#alias-input').press('Enter');

      assert.strictEqual(await page.evaluate(() => localStorage.getItem('metrordle:alias')), 'Karla');
      assert.strictEqual(await page.locator('#alias-notice').isVisible(), true);
    } finally {
      await context.close();
    }
  });

  const debugState = (page) => page.evaluate(() => ({
    stored: localStorage.getItem('metrordle:debug'),
    debug: MetroShared.isDebugMode(),
    dry: MetroShared.isDryRun(),
  }));

  test('the "Modo depuración" three-way toggle (Normal / sin envío / con envío) drives isDebugMode()+isDryRun(), persists, and applies site-wide', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      // Default: Normal (off) - not debug, not dry, no stored key.
      assert.strictEqual(await page.locator('#debug-option-off').getAttribute('aria-pressed'), 'true', '"Normal" should be the default');
      assert.deepStrictEqual(await debugState(page), { stored: null, debug: false, dry: false });

      // Dry run: debug on, submission skipped.
      await page.click('#debug-option-dry');
      assert.strictEqual(await page.locator('#debug-option-dry').getAttribute('aria-pressed'), 'true');
      assert.deepStrictEqual(await debugState(page), { stored: 'dry', debug: true, dry: true }, 'dry: debug UI on, dry-run on (no persist)');

      // Live run: debug on, but NOT dry - submission still happens.
      await page.click('#debug-option-live');
      assert.strictEqual(await page.locator('#debug-option-live').getAttribute('aria-pressed'), 'true');
      assert.strictEqual(await page.locator('#debug-option-dry').getAttribute('aria-pressed'), 'false');
      assert.deepStrictEqual(await debugState(page), { stored: 'live', debug: true, dry: false }, 'live: debug UI on, but NOT dry - scores still persist');

      // Survives a reload, rendered from the stored value.
      await page.reload({ waitUntil: 'networkidle' });
      assert.strictEqual(await page.locator('#debug-option-live').getAttribute('aria-pressed'), 'true', 'should still read as live after a reload');

      // Applies site-wide: a game page with no URL param sees live-run debug.
      await page.goto(server.baseUrl + '/metrocrush/', { waitUntil: 'networkidle' });
      assert.deepStrictEqual(await debugState(page), { stored: 'live', debug: true, dry: false }, 'live-run debug applies on any page, no URL param needed');

      // Back to Normal: clears the key.
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      await page.click('#debug-option-off');
      assert.deepStrictEqual(await debugState(page), { stored: null, debug: false, dry: false }, 'Normal removeItem()s the key');
    } finally {
      await context.close();
    }
  });

  test('a ?debug URL param (presence, any value) means dry-run debug - the safe legacy entry that never persists', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/?debug', { waitUntil: 'networkidle' });
      assert.deepStrictEqual(await debugState(page), { stored: null, debug: true, dry: true }, '?debug (no value) -> dry-run debug');

      await page.goto(server.baseUrl + '/metrocrush/?debug=false', { waitUntil: 'networkidle' });
      assert.deepStrictEqual(await debugState(page), { stored: null, debug: true, dry: true }, 'presence enables dry-run regardless of value - even =false');

      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      assert.deepStrictEqual(await debugState(page), { stored: null, debug: false, dry: false }, 'no param, no stored value -> off');
    } finally {
      await context.close();
    }
  });

  test('the "Limpiar caché y recargar" button routes to the /purge/ recovery page', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 700 } });
    const page = await context.newPage();
    try {
      // Stub /purge/ so its real clear-caches-and-redirect-home script
      // doesn't run during the test - we only need to prove the button
      // sends the player there; /purge/'s own behavior is its own concern.
      await page.route('**/purge/', (route) => route.fulfill({
        status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>',
      }));
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });

      const btn = page.locator('#purge-cache-btn');
      assert.strictEqual(await btn.count(), 1, 'the cache-purge button should exist');

      await Promise.all([
        page.waitForURL(/\/purge\/$/),
        btn.click(),
      ]);
      assert.ok(/\/purge\/$/.test(page.url()), 'clicking should navigate to /purge/, got: ' + page.url());
    } finally {
      await context.close();
    }
  });

  test('the Mantenimiento section reports the active cache version (highest, by number) from Cache Storage', async () => {
    // Block the SW so the only metrordle-v* caches are the ones seeded here.
    const context = await browser.newContext({ viewport: { width: 420, height: 700 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/configurar/', { waitUntil: 'networkidle' });
      // Highest by NUMBER (v265 > v99; a string sort would wrongly pick v99).
      await page.evaluate(async () => {
        await caches.open('metrordle-v99');
        await caches.open('metrordle-v265');
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        var el = document.getElementById('app-version-value');
        return el && el.textContent && el.textContent !== '…';
      });
      assert.strictEqual(await page.textContent('#app-version-value'), 'v265', 'should show the highest seeded cache version');
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
