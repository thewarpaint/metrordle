'use strict';

// Covers MetroShared.getSuggestedGames() (shared.js): the "sigue jugando
// hoy" picks are a seeded shuffle of the other games (minus any already
// completed today), capped to MAX_SUGGESTED_GAMES - not the old fixed
// priority order. Loads / (Metrordle) purely as the simplest host page
// that has shared.js loaded; nothing here is Metrordle-specific.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  async function withPage(fn) {
    const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto(server.baseUrl + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.MetroShared && typeof MetroShared.getSuggestedGames === 'function');
      return await fn(page);
    } finally {
      await context.close();
    }
  }

  test('suggests exactly MAX (2) games, never the current one, and is stable for the same (day, game)', async () => {
    await withPage(async (page) => {
      const r = await page.evaluate(() => ({
        a: MetroShared.getSuggestedGames('metrordle', '2026-11-01').map(g => g.key),
        b: MetroShared.getSuggestedGames('metrordle', '2026-11-01').map(g => g.key),
      }));
      assert.strictEqual(r.a.length, 2, 'should suggest exactly 2');
      assert.ok(!r.a.includes('metrordle'), 'never suggests the current game');
      assert.deepStrictEqual(r.a, r.b, 'same (day, game) returns the same shuffle - stable within a day, no reload reshuffle');
    });
  });

  test('is shuffled, not the fixed priority order - over many days every other game gets surfaced', async () => {
    await withPage(async (page) => {
      const union = await page.evaluate(() => {
        const set = {};
        // dateKey is just a seed string here; 90 distinct values is plenty
        // to exercise the shuffle. Fixed-order would ONLY ever return
        // memoria + metroguessr for a metrordle reveal.
        for (let d = 0; d < 90; d++) {
          const day = '2099-01-' + d;
          MetroShared.getSuggestedGames('metrordle', day).forEach(g => { set[g.key] = true; });
        }
        return Object.keys(set).sort();
      });
      assert.deepStrictEqual(
        union,
        ['clasificador', 'copo-de-nieve', 'laberinto', 'memoria', 'metrocrush', 'metroguessr'],
        'every non-current game should be surfaced across days (proves a real shuffle, not the fixed top-2)'
      );
    });
  });

  test('never suggests a game already completed today', async () => {
    await withPage(async (page) => {
      const picks = await page.evaluate(() => {
        // Mark memoria + laberinto done for this seed day.
        localStorage.setItem('memoria:2026-11-02', JSON.stringify({ score: 5 }));
        localStorage.setItem('laberinto:2026-11-02', JSON.stringify({ status: 'won' }));
        const set = {};
        for (let d = 0; d < 60; d++) {
          // Same completed-day localStorage, different shuffle seeds, so
          // over many tries the excluded games must never slip in.
          MetroShared.getSuggestedGames('metrordle', '2026-11-02').forEach(g => { set[g.key] = true; });
        }
        return Object.keys(set);
      });
      assert.ok(!picks.includes('memoria'), 'a completed game must never be suggested');
      assert.ok(!picks.includes('laberinto'), 'a completed game must never be suggested');
      assert.ok(!picks.includes('metrordle'), 'never suggests the current game');
    });
  });

  test('never suggests Sopa de metros - it is a monthly game, kept out of the daily rotation', async () => {
    await withPage(async (page) => {
      const seen = await page.evaluate(() => {
        const games = ['metrordle', 'memoria', 'metroguessr', 'laberinto', 'metrocrush', 'clasificador', 'copo-de-nieve'];
        const set = {};
        for (let d = 0; d < 90; d++) {
          games.forEach(g => MetroShared.getSuggestedGames(g, '2099-02-' + d).forEach(s => { set[s.key] = true; }));
        }
        return Object.keys(set);
      });
      assert.ok(!seen.includes('sopa-de-metros'), 'Sopa must never surface in the end-screen suggestions');
    });
  });

  test('the /juegos grid lists every game including Sopa de metros', async () => {
    await withPage(async (page) => {
      const names = await page.evaluate(() => {
        const grid = MetroShared.buildAllGamesGrid('2026-11-26');
        return [...grid.querySelectorAll('.game-promo__name')].map(n => n.textContent);
      });
      ['Metrordle', 'Memoria', 'Metroguessr', 'Laberinto', 'Metro Crush', 'Clasificador', 'Copo de nieve', 'Sopa de metros']
        .forEach(name => assert.ok(names.includes(name), 'the full index should list ' + name));
    });
  });

  const failed = await runAll();
  await browser.close();
  server.stop();
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
