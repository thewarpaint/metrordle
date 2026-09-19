'use strict';

// Covers Metroguessr's core mechanics: the daily target pick (and its
// no-repeat-per-cycle guarantee from NO_REPEAT_CUTOVER_DATE_KEY on -
// see metroguessr/index.html's pickTarget()), the guess/history flow,
// win/loss reveal, the reveal-map distance/direction guess pins, and
// persistence across reload. The real map (Leaflet/MapLibre/OpenFreeMap)
// is stubbed - see tests/lib/leaflet-stub.js's own comment for why -
// so none of this depends on those hosts being reachable or on real
// tiles rendering; it exercises the game logic layered on top instead.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap, guess, FILLER_GUESSES, playToReveal, revealedTarget } = require('../lib/metroguessr-helpers');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('the daily puzzle is deterministic - two independent sessions on the same date get the same target', async () => {
    const DATE = '2026-09-20'; // after NO_REPEAT_CUTOVER_DATE_KEY (2026-09-18)
    const contextA = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const contextB = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await stubMap(pageA);
      await stubMap(pageB);
      await pageA.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await pageB.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await pageA.waitForTimeout(200);
      await pageB.waitForTimeout(200);

      await playToReveal(pageA);
      await playToReveal(pageB);

      const targetA = await revealedTarget(pageA);
      const targetB = await revealedTarget(pageB);
      assert.ok(targetA, 'expected a non-empty target');
      assert.strictEqual(targetA, targetB, 'the same date should reveal the same target in two independent sessions');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('no two of ten consecutive post-cutover days repeat the same target', async () => {
    // NO_REPEAT_CUTOVER_DATE_KEY is 2026-09-18 - every date here is on
    // or after it, so all ten should draw from the same shuffled
    // STATION_ORDER cycle (147 stations), far from wrapping around.
    const DATES = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    try {
      const targets = [];
      for (const date of DATES) {
        const page = await context.newPage();
        await stubMap(page);
        await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + date, { waitUntil: 'networkidle' });
        await page.waitForTimeout(150);
        await playToReveal(page);
        targets.push(await revealedTarget(page));
        await page.close();
      }
      const seen = new Set(targets);
      assert.strictEqual(seen.size, targets.length, 'expected no duplicate targets, got: ' + JSON.stringify(targets));
    } finally {
      await context.close();
    }
  });

  test('a wrong guess adds a distance+direction history chip; a correct guess ends the round as a win', async () => {
    const DATE = '2026-09-21';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      // Guess a station guaranteed not to be today's target, to observe
      // the wrong-guess path first.
      await guess(page, FILLER_GUESSES[0]);
      const chipCountAfterOne = await page.locator('.history-chip').count();
      assert.strictEqual(chipCountAfterOne, 1, 'a guess should add exactly one history chip');
      const chipText = await page.locator('.history-chip').first().textContent();
      assert.ok(/\d/.test(chipText), 'the chip should show a distance, got: ' + chipText);

      // Now guess the real target (read off the reveal after losing in
      // a second, throwaway session) and confirm the round ends
      // immediately as a win instead of waiting for 5 attempts.
      const throwaway = await context.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await throwaway.waitForTimeout(150);
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwaway.close();

      await guess(page, target);
      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'guessing the real target should end the round');
      const bannerText = await page.locator('#reveal-banner').textContent();
      assert.strictEqual(bannerText, '¡Correcto!');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('five wrong guesses end the round as a loss, with a single-line reveal and the history chips hidden', async () => {
    const DATE = '2026-09-22';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      await playToReveal(page);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'the round should be over');
      assert.strictEqual(await page.locator('.pip--used, .pip--win').count() >= 1, true, 'expects at least one used pip');

      // Single line: banner + station text live in one <p>, not two.
      assert.strictEqual(await page.locator('p.reveal__line').count(), 1, 'expected exactly one .reveal__line paragraph');
      const lineText = await page.locator('.reveal__line').textContent();
      assert.ok(lineText.includes('La estación era:'), 'expected the station name in the reveal line, got: ' + lineText);

      // The distance/direction history chips have nothing left to add
      // once the round ends - the wrapper hides, freeing space for the
      // now-unlocked map.
      assert.strictEqual(await page.locator('#history-scroll').isVisible(), false, 'history-scroll should hide once the round ends');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('the reveal shows the target\'s own station-icon badge, colored by its line', async () => {
    const DATE = '2026-09-23';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await playToReveal(page);
      const target = await revealedTarget(page);

      const badge = await page.evaluate((targetName) => {
        var line = null;
        for (var i = 0; i < MetroShared.LINES.length; i++) {
          if (MetroShared.LINES[i].stations.indexOf(targetName) !== -1) { line = MetroShared.LINES[i]; break; }
        }
        var slug = MetroShared.STATION_ICON_SLUGS[targetName];
        var el = window.__mgIconMarkerEl;
        var use = el ? el.querySelector('use') : null;
        return {
          expectedColor: line && line.color,
          expectedTextColor: line && line.textColor,
          expectedSlug: slug || null,
          badgeBg: el ? el.style.getPropertyValue('--badge-bg') : null,
          badgeInk: el ? el.style.getPropertyValue('--badge-ink') : null,
          actualHref: use ? use.getAttribute('href') : null,
        };
      }, target);

      assert.strictEqual(badge.badgeBg, badge.expectedColor, 'badge background should match the target line\'s color');
      assert.strictEqual(badge.badgeInk, badge.expectedTextColor, 'badge text color should match the target line\'s text color');
      assert.strictEqual(badge.actualHref, '/station-icons.svg#' + badge.expectedSlug, 'badge icon should be the target\'s own pictogram');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('guess pins on the reveal map show for every player, deduped per station', async () => {
    const DATE = '2026-09-24';

    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    try {
      await stubMap(page);
      // No ?debug=true - these pins are an ordinary part of the reveal
      // now, not a debugging aid gated behind date-nav testing.
      await page.goto(server.baseUrl + '/metroguessr/?date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      // Repeat one wrong guess deliberately - it should collapse to a
      // single pin instead of stacking duplicates.
      await guess(page, FILLER_GUESSES[0]);
      await guess(page, FILLER_GUESSES[1]);
      await guess(page, FILLER_GUESSES[0]);
      await guess(page, FILLER_GUESSES[2]);
      await guess(page, FILLER_GUESSES[3]);
      if (!(await page.locator('#reveal').isVisible())) {
        await guess(page, FILLER_GUESSES[4]);
      }
      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'the round should be over');

      // Computed inside evaluate() and reduced to plain data before
      // returning - m.el is a DOM element live in the page and doesn't
      // survive the page-to-Node boundary Playwright serializes across.
      const markers = await page.evaluate(() => (window.__mgMarkers || [])
        .filter((m) => m.className === 'guess-marker')
        .map((m) => ({ pillCount: m.el.querySelectorAll('.guess-marker__pill').length })));
      const uniqueWrongGuesses = new Set(FILLER_GUESSES.slice(0, 4)).size; // FILLER_GUESSES[0] repeated once
      assert.ok(markers.length <= uniqueWrongGuesses, 'expected no more pins than unique wrong guesses, got ' + markers.length);
      assert.ok(markers.length >= 1, 'expected at least one guess pin');
      for (const m of markers) {
        assert.strictEqual(m.pillCount, 1, 'each pin should have exactly one .guess-marker__pill child');
      }
    } finally {
      await context.close();
    }
  });

  test('a narrow (mobile-width) viewport starts one zoom level further out than a wide one', async () => {
    const DATE = '2026-09-26';

    const narrowContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const narrowPage = await narrowContext.newPage();
    try {
      await stubMap(narrowPage);
      await narrowPage.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await narrowPage.waitForTimeout(150);
      const narrowZoom = await narrowPage.evaluate(() => window.__mgMap && window.__mgMap._zoom);
      assert.strictEqual(narrowZoom, 14, 'a 400px-wide (mobile) viewport should start one level further out');
    } finally {
      await narrowContext.close();
    }

    const wideContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const widePage = await wideContext.newPage();
    try {
      await stubMap(widePage);
      await widePage.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await widePage.waitForTimeout(150);
      const wideZoom = await widePage.evaluate(() => window.__mgMap && window.__mgMap._zoom);
      assert.strictEqual(wideZoom, 15, 'a 1200px-wide (desktop) viewport should keep the original zoom level');
    } finally {
      await wideContext.close();
    }
  });

  test('reloading mid-round restores the guesses so far; reloading after the round ends restores the reveal', async () => {
    const DATE = '2026-09-25';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      await guess(page, FILLER_GUESSES[0]);
      await guess(page, FILLER_GUESSES[1]);
      const chipsBefore = await page.locator('.history-chip').count();
      assert.strictEqual(chipsBefore, 2);

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.locator('#reveal').isVisible(), false, 'a partial round should not show the reveal after reload');
      assert.strictEqual(await page.locator('.history-chip').count(), 2, 'the two prior guesses should be restored after reload');

      await playToReveal(page);
      assert.strictEqual(await page.locator('#reveal').isVisible(), true);
      const chipCountDone = await page.locator('.history-chip').count();
      const bannerBefore = await page.locator('#reveal-banner').textContent();

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'a finished round should restore straight into the reveal');
      assert.strictEqual(await page.locator('.history-chip').count(), chipCountDone, 'all guesses should still be there after reload');
      assert.strictEqual(await page.locator('#reveal-banner').textContent(), bannerBefore, 'the same win/loss result should be restored');
      // A disabled input is itself the no-op guarantee - a real player
      // has no way to submit a further guess once a day is done.
      assert.strictEqual(await page.locator('#guess-input').isDisabled(), true, 'the guess input should stay disabled on a done day');
      assert.strictEqual(await page.locator('#guess-btn').isDisabled(), true, 'the guess button should stay disabled on a done day');

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
