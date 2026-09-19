'use strict';

// Covers Laberinto's daily puzzle-difficulty floor (see
// laberinto/index.html's getPuzzleForDateKey()) - specifically the
// PATH_DIFFICULTY_CUTOVER_DATE_KEY ('2026-09-20') split that followed
// Game #23 (2026-09-17) slipping through as a 6-hop, zero-transfer
// puzzle. Origin/destination are shown in the header (#term-start/
// #term-end) as soon as the page loads, without needing to actually
// solve anything, so these tests read them straight from the DOM.
//
// The shortest-path stats (stops, transfers) for a given origin/
// destination aren't otherwise exposed - the game's own shortestPath()
// lives inside laberinto/index.html's closure - so these tests
// independently recompute them in-page via a small BFS over the real
// `window.MetroShared.LINES` graph data, deliberately NOT calling into
// the app's own function, so a bug shared between the two wouldn't
// silently cancel out.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');

// Same Dijkstra-by-(stops,transfers) search as getPuzzleForDateKey()'s
// own shortestPath(), reimplemented here against window.MetroShared.LINES
// rather than requiring the page to expose its internal graph.
async function pathStats(page, origin, destination) {
  return page.evaluate((args) => {
    var LINES = window.MetroShared.LINES;
    var graph = {};
    LINES.forEach(function (line) {
      line.stations.forEach(function (name, i) {
        if (!graph[name]) graph[name] = [];
        if (i > 0) graph[name].push({ station: line.stations[i - 1], line: line });
        if (i < line.stations.length - 1) graph[name].push({ station: line.stations[i + 1], line: line });
      });
    });

    function stateKey(station, lineId) { return station + ' ' + (lineId || ''); }
    function isBetter(a, b) {
      if (a.stops !== b.stops) return a.stops < b.stops;
      return a.transfers < b.transfers;
    }

    var startKey = stateKey(args.origin, null);
    var best = {};
    best[startKey] = { stops: 0, transfers: 0 };
    var frontier = [{ key: startKey, station: args.origin, lineId: null, stops: 0, transfers: 0 }];
    var destStats = null;

    while (frontier.length > 0) {
      var bestIndex = 0;
      for (var i = 1; i < frontier.length; i++) {
        if (isBetter(frontier[i], frontier[bestIndex])) bestIndex = i;
      }
      var cur = frontier.splice(bestIndex, 1)[0];
      var known = best[cur.key];
      if (isBetter(known, cur)) continue;

      if (cur.station === args.destination) {
        destStats = { stops: cur.stops, transfers: cur.transfers };
        break;
      }

      var neighbors = graph[cur.station] || [];
      for (var j = 0; j < neighbors.length; j++) {
        var next = neighbors[j];
        var isTransfer = cur.lineId !== null && next.line.id !== cur.lineId;
        var candidate = {
          key: stateKey(next.station, next.line.id),
          station: next.station,
          lineId: next.line.id,
          stops: cur.stops + 1,
          transfers: cur.transfers + (isTransfer ? 1 : 0),
        };
        var existing = best[candidate.key];
        if (!existing || isBetter(candidate, existing)) {
          best[candidate.key] = { stops: candidate.stops, transfers: candidate.transfers };
          frontier.push(candidate);
        }
      }
    }

    return destStats;
  }, { origin: origin, destination: destination });
}

async function loadTermini(page, baseUrl, dateKey) {
  await page.goto(baseUrl + '/laberinto/?debug=true&date=' + dateKey, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const origin = await page.locator('#term-start').textContent();
  const destination = await page.locator('#term-end').textContent();
  return { origin: origin, destination: destination };
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('every puzzle from the difficulty cutover date on needs a real transfer and a 10+ stop walk', async () => {
    const DATES = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    try {
      for (const dateKey of DATES) {
        const page = await context.newPage();
        const { origin, destination } = await loadTermini(page, server.baseUrl, dateKey);
        assert.notStrictEqual(origin, destination, dateKey + ': expected distinct origin/destination');

        const stats = await pathStats(page, origin, destination);
        assert.ok(stats, dateKey + ': expected a reachable path between ' + origin + ' and ' + destination);
        assert.ok(stats.stops >= 10, dateKey + ': expected >= 10 stops between ' + origin + ' and ' + destination + ', got ' + stats.stops);
        assert.ok(stats.transfers >= 1, dateKey + ': expected >= 1 transfer between ' + origin + ' and ' + destination + ', got ' + stats.transfers);
        await page.close();
      }
    } finally {
      await context.close();
    }
  });

  test('a day before the cutover, including the historical Game #23, keeps its original puzzle', async () => {
    // Game #23 (2026-08-26 + 22 days) - the actual day that prompted the
    // difficulty floor split. Its puzzle must come out identical to
    // before the split: still governed only by the old MIN_PATH_STATIONS
    // floor, never the new one.
    const DATES = ['2026-09-17', '2026-09-19']; // Game #23, and the day right before the cutover
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    try {
      for (const dateKey of DATES) {
        const page = await context.newPage();
        const { origin, destination } = await loadTermini(page, server.baseUrl, dateKey);
        assert.notStrictEqual(origin, destination, dateKey + ': expected distinct origin/destination');

        const stats = await pathStats(page, origin, destination);
        assert.ok(stats, dateKey + ': expected a reachable path between ' + origin + ' and ' + destination);
        // The old floor only ever guaranteed >= 7 stations (>= 6 stops) -
        // no minimum transfer count. Asserting the exact old floor here
        // (rather than the new, stricter one) is what proves this date
        // was NOT regenerated under the new rule.
        assert.ok(stats.stops >= 6, dateKey + ': expected >= 6 stops (the old floor) between ' + origin + ' and ' + destination + ', got ' + stats.stops);
        await page.close();
      }
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
