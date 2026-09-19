'use strict';

// Covers Metroguessr's core mechanics: the daily target pick (and its
// no-repeat-per-cycle guarantee from NO_REPEAT_CUTOVER_DATE_KEY on -
// see metroguessr/index.html's pickTarget()), the guess/history flow,
// win/loss reveal, the reveal-map distance/direction guess pins, the
// normal/hard mode choice, and persistence across reload. The real map
// (Leaflet/MapLibre/OpenFreeMap) is stubbed - see tests/lib/leaflet-stub.js's
// own comment for why - so none of this depends on those hosts being
// reachable or on real tiles rendering; it exercises the game logic
// layered on top instead.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { stubMap, chooseMode, guess, FILLER_GUESSES, playToReveal, revealedTarget } = require('../lib/metroguessr-helpers');

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
      // now, not a debugging aid gated behind date-nav testing. That
      // also means the mode-modal actually shows (it's skipped under
      // ?debug=true) - dismiss it before anything else can happen.
      await page.goto(server.baseUrl + '/metroguessr/?date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await chooseMode(page, 'hard');

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

  test('a fresh day shows the mode modal, and the chosen mode controls whether the map stays locked', async () => {
    const DATE = '2026-09-28';

    // Normal mode: the modal shows on a fresh day (no ?debug=true, no
    // saved state) and picking it leaves the map free to drag/zoom
    // immediately, not just once the round ends.
    const normalContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const normalPage = await normalContext.newPage();
    try {
      await stubMap(normalPage);
      await normalPage.goto(server.baseUrl + '/metroguessr/?date=' + DATE, { waitUntil: 'networkidle' });
      await normalPage.waitForTimeout(150);
      assert.strictEqual(await normalPage.locator('#mode-modal').isVisible(), true, 'expected the mode modal on a fresh day');

      await normalPage.click('#mode-normal-btn');
      await normalPage.waitForTimeout(100);
      assert.strictEqual(await normalPage.locator('#mode-modal').isVisible(), false, 'expected the modal to close after picking a mode');

      const draggingEnabled = await normalPage.evaluate(() => window.__mgHandlers.dragging._enabled);
      assert.strictEqual(draggingEnabled, true, 'expected the map to be draggable immediately in normal mode');

      // Mode (like the rest of the round) is only persisted once there's
      // an actual guess to save alongside it (see persistState()) - a
      // reload before that point has nothing saved yet either way, so
      // the modal reappearing there just means "nothing happened yet,"
      // not a lost choice. Make one guess first, matching what a real
      // reload-mid-round actually looks like.
      await guess(normalPage, FILLER_GUESSES[0]);
      await normalPage.reload({ waitUntil: 'networkidle' });
      await normalPage.waitForTimeout(150);
      assert.strictEqual(await normalPage.locator('#mode-modal').isVisible(), false, 'expected no second mode prompt on a reload after a real guess');

      const draggingStillEnabled = await normalPage.evaluate(() => window.__mgHandlers.dragging._enabled);
      assert.strictEqual(draggingStillEnabled, true, 'expected normal mode to survive the reload');
    } finally {
      await normalContext.close();
    }

    // Hard mode: a different fresh day, picking hard keeps the map
    // locked while playing - the pre-existing behavior from before the
    // normal/hard split.
    const hardContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const hardPage = await hardContext.newPage();
    try {
      await stubMap(hardPage);
      await hardPage.goto(server.baseUrl + '/metroguessr/?date=2026-09-29', { waitUntil: 'networkidle' });
      await hardPage.waitForTimeout(150);
      await hardPage.click('#mode-hard-btn');
      await hardPage.waitForTimeout(100);

      const draggingEnabled = await hardPage.evaluate(() => window.__mgHandlers.dragging._enabled);
      assert.strictEqual(draggingEnabled, false, 'expected the map to stay locked while playing in hard mode');
    } finally {
      await hardContext.close();
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

  test('the hint button unlocks after the first guess, reveals the line then street labels, and burns an attempt each time', async () => {
    const DATE = '2026-09-30';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      // Figure out today's real target first (via a throwaway session,
      // in its OWN context - sharing this test's own context would play
      // that date out to a done state in the shared localStorage before
      // the main page below ever loads it) so the actual test session
      // can guess something guaranteed wrong - guessing the target
      // outright would end the round before any hint could be used.
      const throwawayContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
      const throwaway = await throwawayContext.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await throwaway.waitForTimeout(150);
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwawayContext.close();
      const wrongGuess = FILLER_GUESSES.find((name) => name !== target);

      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      assert.strictEqual(await page.locator('#hint-btn').isVisible(), false, 'no hint before the first guess');

      await guess(page, wrongGuess);
      assert.strictEqual(await page.locator('#hint-btn').isVisible(), true, 'expected the hint button after the first guess');
      assert.ok((await page.locator('#hint-btn').textContent()).includes('línea'), 'first hint should offer to reveal the line');
      const usedPipsAfterGuess = await page.locator('.pip--used, .pip--win').count();

      await page.click('#hint-btn');
      await page.waitForTimeout(80);

      const usedPipsAfterHint1 = await page.locator('.pip--used, .pip--win').count();
      assert.strictEqual(usedPipsAfterHint1, usedPipsAfterGuess + 1, 'a hint should burn one attempt/pip');

      const targetLine = await page.evaluate((name) => {
        for (var i = 0; i < MetroShared.LINES.length; i++) {
          if (MetroShared.LINES[i].stations.indexOf(name) !== -1) return MetroShared.LINES[i];
        }
        return null;
      }, target);
      const markerAfterHint1 = await page.evaluate(() => ({
        hasClass: window.__mgMarkerEl.classList.contains('target-marker--line-revealed'),
        color: window.__mgMarkerEl.style.getPropertyValue('--reveal-line-color'),
      }));
      assert.strictEqual(markerAfterHint1.hasClass, true, 'the live marker should get the line-revealed class');
      assert.strictEqual(markerAfterHint1.color, targetLine.color, 'the marker should recolor to the target line\'s color');
      assert.ok((await page.locator('#hint-status').textContent()).includes(targetLine.name), 'the hint status should name the line as text too');

      assert.ok((await page.locator('#hint-btn').textContent()).includes('calles'), 'second hint should offer to reveal street labels');
      const labelsBeforeHint2 = await page.evaluate(() => (window.__mgLayoutProps || {})['place-labels']);
      assert.ok(!labelsBeforeHint2 || labelsBeforeHint2.visibility !== 'visible', 'labels should stay hidden before the second hint');

      await page.click('#hint-btn');
      await page.waitForTimeout(80);

      const usedPipsAfterHint2 = await page.locator('.pip--used, .pip--win').count();
      assert.strictEqual(usedPipsAfterHint2, usedPipsAfterHint1 + 1, 'the second hint should also burn one attempt/pip');
      assert.strictEqual(await page.locator('#hint-btn').isVisible(), false, 'no more hints left after both are used');
      const labelsAfterHint2 = await page.evaluate(() => (window.__mgLayoutProps || {})['place-labels']);
      assert.strictEqual(labelsAfterHint2 && labelsAfterHint2.visibility, 'visible', 'the second hint should reveal street labels early');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('hint state survives a reload mid-round', async () => {
    const DATE = '2026-10-01';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    try {
      const throwawayContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
      const throwaway = await throwawayContext.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await throwaway.waitForTimeout(150);
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwawayContext.close();
      const wrongGuess = FILLER_GUESSES.find((name) => name !== target);

      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      await guess(page, wrongGuess);
      await page.click('#hint-btn');
      await page.waitForTimeout(80);
      const hintStatusBefore = await page.locator('#hint-status').textContent();

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      assert.ok((await page.locator('#hint-btn').textContent()).includes('calles'), 'the second hint should still be offered after reload');
      assert.strictEqual(await page.locator('#hint-status').textContent(), hintStatusBefore, 'the line hint text should survive the reload');
      const markerAfterReload = await page.evaluate(() => window.__mgMarkerEl.classList.contains('target-marker--line-revealed'));
      assert.strictEqual(markerAfterReload, true, 'the marker recoloring should be reapplied after reload');
    } finally {
      await context.close();
    }
  });

  test('using both hints as the final attempts ends the round as a loss', async () => {
    const DATE = '2026-10-02';
    const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
    const page = await context.newPage();
    try {
      const throwawayContext = await browser.newContext({ viewport: { width: 400, height: 900 } });
      const throwaway = await throwawayContext.newPage();
      await stubMap(throwaway);
      await throwaway.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await throwaway.waitForTimeout(150);
      await playToReveal(throwaway);
      const target = await revealedTarget(throwaway);
      await throwawayContext.close();
      const wrongGuesses = FILLER_GUESSES.filter((name) => name !== target);

      await stubMap(page);
      await page.goto(server.baseUrl + '/metroguessr/?debug=true&date=' + DATE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      // Three wrong guesses (3 attempts) + two hints (2 more) = 5, the
      // round's cap - the round should end right on the second hint,
      // without needing a fifth guess.
      await guess(page, wrongGuesses[0]);
      await guess(page, wrongGuesses[1]);
      await guess(page, wrongGuesses[2]);
      assert.strictEqual(await page.locator('#reveal').isVisible(), false, 'three wrong guesses alone should not end the round yet');

      await page.click('#hint-btn');
      await page.waitForTimeout(80);
      assert.strictEqual(await page.locator('#reveal').isVisible(), false, 'one hint after three guesses should still leave one attempt');

      await page.click('#hint-btn');
      await page.waitForTimeout(80);

      assert.strictEqual(await page.locator('#reveal').isVisible(), true, 'the fifth burned attempt (via hint) should end the round');
      assert.strictEqual(await page.locator('#reveal-banner').textContent(), 'Se acabaron los intentos');
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
