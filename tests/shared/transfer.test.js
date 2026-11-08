'use strict';

// Covers MetroShared.createTransfer()/restoreTransfer() (shared.js) - the
// PWA data-transfer feature (see docs/systems.md -> "PWA install & data
// transfer"). An installed PWA on iOS gets storage separate from Safari, so
// a player snapshots all their localStorage into a one-shot transfers/{id}
// Firestore doc and merges it back on the new device.
//
// Uses tests/lib/firestore-stub.js (whose doc store now backs .doc().set()
// too) as the fake backend, so the REAL create/restore logic runs against a
// realistic Firestore surface rather than its "Firebase unreachable" early
// return. Loads /tablero/ purely as a convenient host page that already
// pulls in shared.js - nothing here is specific to /tablero/.

const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, test, runAll } = require('../lib/harness');
const { installFirestoreStub } = require('../lib/firestore-stub');

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  test('createTransfer snapshots localStorage and restoreTransfer merges it back, never regressing a streak already on the new device', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installFirestoreStub(page, {});
      await page.goto(server.baseUrl + '/tablero/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      // Seed the "old device": alias, config, two streaks, a RECENT daily
      // state (within the keep window) and an OLD one (must be pruned from
      // the snapshot so a long history can't blow past the size cap).
      const recentDailyKey = await page.evaluate(() => {
        function dk(offset) {
          var d = new Date(); d.setDate(d.getDate() + offset);
          var p = function (n) { return String(n).padStart(2, '0'); };
          return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        }
        localStorage.clear();
        localStorage.setItem('metrordle:alias', 'Eduardo');
        localStorage.setItem('metrordle:config', JSON.stringify({ mode: 'dark', reducedMotion: true }));
        localStorage.setItem('metrordle:streak', JSON.stringify({ count: 9, max: 12, lastResultDate: '2026-11-08' }));
        localStorage.setItem('metrocrush:streak', JSON.stringify({ count: 3, max: 3, lastResultDate: '2026-11-07' }));
        var recent = 'metrocrush:' + dk(-2);
        localStorage.setItem(recent, JSON.stringify({ score: 420 }));
        localStorage.setItem('metrocrush:2020-01-01', JSON.stringify({ score: 999 })); // old -> pruned
        return recent;
      });

      const code = await page.evaluate(() => MetroShared.createTransfer());
      assert.ok(typeof code === 'string' && code.length >= 10, 'createTransfer should resolve a non-trivial code, got: ' + code);

      // Simulate a FRESH install: wipe storage, but give THIS device a
      // HIGHER metrocrush streak that the restore must not regress.
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('metrocrush:streak', JSON.stringify({ count: 5, max: 7, lastResultDate: '2026-11-09' }));
      });

      const res = await page.evaluate((id) => MetroShared.restoreTransfer(id), code);
      assert.strictEqual(res.restored, true, 'restore should succeed: ' + JSON.stringify(res));

      const after = await page.evaluate((recent) => ({
        alias: localStorage.getItem('metrordle:alias'),
        config: JSON.parse(localStorage.getItem('metrordle:config')),
        metrordleStreak: JSON.parse(localStorage.getItem('metrordle:streak')),
        metrocrushStreak: JSON.parse(localStorage.getItem('metrocrush:streak')),
        recentDaily: localStorage.getItem(recent),
        oldDaily: localStorage.getItem('metrocrush:2020-01-01'),
      }), recentDailyKey);

      assert.strictEqual(after.alias, 'Eduardo', 'alias should be adopted (the fresh device had none)');
      assert.deepStrictEqual(after.metrordleStreak, { count: 9, max: 12, lastResultDate: '2026-11-08' },
        'a streak the device lacked should be restored verbatim');
      assert.deepStrictEqual(after.metrocrushStreak, { count: 5, max: 7, lastResultDate: '2026-11-09' },
        'the HIGHER local metrocrush streak must be kept - restore merges by max, never regresses');
      assert.strictEqual(after.recentDaily, JSON.stringify({ score: 420 }),
        'a recent daily state (within the keep window) should be filled from the snapshot');
      assert.strictEqual(after.oldDaily, null,
        'an old daily state should be pruned from the snapshot, never restored - this is what bounds the payload size');
      assert.strictEqual(after.config.mode, 'dark', 'config should be adopted from the snapshot on a fresh device');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('restoreTransfer reports missing / expired / empty codes without throwing', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installFirestoreStub(page, {});
      await page.goto(server.baseUrl + '/tablero/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      const empty = await page.evaluate(() => MetroShared.restoreTransfer('   '));
      assert.deepStrictEqual(empty, { restored: false, reason: 'empty' }, 'a blank code is rejected as empty');

      const notFound = await page.evaluate(() => MetroShared.restoreTransfer('doesNotExist123'));
      assert.deepStrictEqual(notFound, { restored: false, reason: 'not-found' }, 'an unknown code is not-found');

      // Seed a doc older than the 7-day window directly in the stub's doc
      // store; restore must refuse it before touching localStorage.
      const expired = await page.evaluate(() => {
        window.__firestoreStubDocs = window.__firestoreStubDocs || {};
        var eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
        window.__firestoreStubDocs['transfers/staleCode'] = {
          schema: 1,
          data: JSON.stringify({ 'metrordle:alias': 'ShouldNotLand' }),
          createdAt: { toMillis: function () { return eightDaysAgo; } },
        };
        return MetroShared.restoreTransfer('staleCode').then(function (res) {
          return { res: res, alias: localStorage.getItem('metrordle:alias') };
        });
      });
      assert.strictEqual(expired.res.reason, 'expired', 'a doc older than 7 days is expired');
      assert.strictEqual(expired.alias, null, 'an expired doc must not write anything to localStorage');

      assert.strictEqual(errors.length, 0, 'expected no page errors: ' + JSON.stringify(errors));
    } finally {
      await context.close();
    }
  });

  test('exportLocalData hard-caps the snapshot under the rules size limit, dropping oldest daily states first', async () => {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await installFirestoreStub(page, {});
      await page.goto(server.baseUrl + '/tablero/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      // Six recent (in-window) daily states of ~18KB each = ~108KB, over the
      // cap - even after the keep-window prune, the snapshot must shrink.
      const result = await page.evaluate(() => {
        function dk(offset) {
          var d = new Date(); d.setDate(d.getDate() + offset);
          var p = function (n) { return String(n).padStart(2, '0'); };
          return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        }
        localStorage.clear();
        localStorage.setItem('metrordle:streak', JSON.stringify({ count: 5, max: 9, lastResultDate: dk(0) }));
        var big = 'x'.repeat(18000);
        for (var i = 1; i <= 6; i++) localStorage.setItem('metrocrush:' + dk(-i), JSON.stringify({ blob: big }));
        var snap = MetroShared.exportLocalData();
        return {
          chars: JSON.stringify(snap).length,
          keptStreak: !!snap['metrordle:streak'],
          hasNewest: !!snap['metrocrush:' + dk(-1)],
          hasOldest: !!snap['metrocrush:' + dk(-6)],
        };
      });

      assert.ok(result.chars <= 95000, 'the snapshot must be capped under the rules size limit, got ' + result.chars);
      assert.ok(result.keptStreak, 'undated keys (streak/alias/config) are always kept, never dropped for size');
      assert.ok(result.hasNewest, 'the newest daily state is kept');
      assert.ok(!result.hasOldest, 'the oldest daily state is dropped first to fit under the cap');

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
