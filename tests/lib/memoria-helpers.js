'use strict';

// DOM helpers shared by the Memoria test files - reads the board state
// through the same classes/attributes a player would see, rather than
// reaching into the page's internal JS state, so these tests exercise
// the game the way a browser actually renders it.

function checkerboardOk(types) {
  for (var i = 0; i < 16; i++) {
    var row = Math.floor(i / 4);
    var col = i % 4;
    var expected = (row + col) % 2 === 0 ? 'icon' : 'name';
    if (types[i] !== expected) {
      return { ok: false, index: i, expected: expected, actual: types[i] };
    }
  }
  return { ok: true };
}

function getCardTypes(page) {
  return page.$$eval('.memo-card', function (els) {
    return els.map(function (e) {
      return e.classList.contains('memo-card--icon') ? 'icon' : e.classList.contains('memo-card--name') ? 'name' : 'empty';
    });
  });
}

function getCells(page) {
  return page.$$eval('.memo-card', function (els) {
    return els.map(function (e) {
      var nameEl = e.querySelector('.memo-card__name');
      return {
        matched: e.classList.contains('memo-card--matched'),
        empty: e.classList.contains('memo-card--empty'),
        disabled: e.disabled,
        label: e.getAttribute('aria-label') || (nameEl ? nameEl.textContent : null),
      };
    });
  });
}

async function findMatchingStation(page) {
  var cells = await getCells(page);
  var counts = {};
  cells.filter(function (c) { return !c.matched && !c.empty; }).forEach(function (c) {
    counts[c.label] = (counts[c.label] || 0) + 1;
  });
  return Object.keys(counts).find(function (k) { return counts[k] === 2; }) || null;
}

async function clickCardForStation(page, station) {
  var cards = await page.$$('.memo-card:not(.memo-card--matched):not(.memo-card--empty):not(.memo-card--selected)');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var label = await card.getAttribute('aria-label') ||
      await card.$eval('.memo-card__name', function (el) { return el.textContent; }).catch(function () { return null; });
    if (label === station) {
      await card.click();
      return true;
    }
  }
  throw new Error('No unselected card found for station: ' + station);
}

// Clicks both cards for one matchable station and returns which station
// it was, or null if the board has no complete pair left to match
// (shouldn't happen mid-round, since a match always refills its slots).
async function matchOnePair(page) {
  var station = await findMatchingStation(page);
  if (!station) return null;
  await clickCardForStation(page, station);
  await page.waitForTimeout(60);
  await clickCardForStation(page, station);
  return station;
}

function keyedRects(page) {
  return page.$$eval('.memo-card[data-key]', function (els) {
    return Object.fromEntries(els.map(function (e) {
      var r = e.getBoundingClientRect();
      return [e.dataset.key, { left: r.left, top: r.top }];
    }));
  });
}

module.exports = {
  checkerboardOk: checkerboardOk,
  getCardTypes: getCardTypes,
  getCells: getCells,
  findMatchingStation: findMatchingStation,
  clickCardForStation: clickCardForStation,
  matchOnePair: matchOnePair,
  keyedRects: keyedRects,
};
