'use strict';

// Helpers shared by the Metroguessr test files - see leaflet-stub.js's
// own comment for why the map itself is stubbed here (unlike Firebase
// elsewhere in this suite, it's a hard rendering dependency, not an
// optional one).

const fs = require('fs');
const path = require('path');

const LEAFLET_STUB_JS = fs.readFileSync(path.join(__dirname, 'leaflet-stub.js'), 'utf8');

async function stubMap(page) {
  await page.route('**/cdnjs.cloudflare.com/**leaflet*.min.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: LEAFLET_STUB_JS }));
  await page.route('**/cdnjs.cloudflare.com/**leaflet*.min.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/cdnjs.cloudflare.com/**maplibre-gl*.min.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/cdnjs.cloudflare.com/**maplibre-gl*.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**maplibre-gl-leaflet**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }));
  // Real map tiles and Firebase are both unreachable in a network-
  // restricted CI environment anyway - aborting them here keeps that
  // true (and fast) even where the host running these tests does have
  // real internet access, so behavior doesn't vary by environment.
  await page.route('**/tiles.openfreemap.org/**', (route) => route.abort());
  await page.route('**/www.gstatic.com/**', (route) => route.abort());
}

// Types a station name into the guess input, picks the first matching
// suggestion if the typeahead offers one, and submits it - the same
// path a player takes, rather than reaching into the page's internal
// JS state.
async function guess(page, name) {
  await page.fill('#guess-input', name);
  await page.waitForTimeout(80);
  if (await page.locator('.suggestion').count()) {
    await page.locator('.suggestion').first().click();
  }
  await page.waitForTimeout(50);
  await page.click('#guess-btn');
  await page.waitForTimeout(120);
}

// Dismisses the pre-game normal/hard mode-modal by picking `mode` - a
// no-op if it isn't showing (e.g. under ?debug=true, which always skips
// it - see startGame() in metroguessr/index.html). Needed by any test
// that loads the page WITHOUT ?debug=true on a fresh day, since the
// modal otherwise blocks every other interaction.
async function chooseMode(page, mode) {
  const modalShowing = await page.$('#mode-modal:not([hidden])');
  if (!modalShowing) return;
  await page.click(mode === 'normal' ? '#mode-normal-btn' : '#mode-hard-btn');
}

// Five stations spread across different lines/areas of the network -
// used whenever a test just needs to end a round (win or lose, doesn't
// matter which - whichever one happens to match that day's real target
// ends it as a win instead of a loss, but the reveal fires either way).
const FILLER_GUESSES = ['Zocalo', 'Chapultepec', 'Pantitlan', 'Tacubaya', 'Universidad'];

async function playToReveal(page) {
  for (const name of FILLER_GUESSES) {
    if (await page.locator('#reveal').isVisible()) break;
    await guess(page, name);
  }
}

function revealedTarget(page) {
  return page.locator('#reveal-station').textContent().then((t) => t.replace('La estación era: ', '').trim());
}

module.exports = {
  stubMap: stubMap,
  chooseMode: chooseMode,
  guess: guess,
  FILLER_GUESSES: FILLER_GUESSES,
  playToReveal: playToReveal,
  revealedTarget: revealedTarget,
};
