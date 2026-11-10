'use strict';

// Loads sw.js in a sandboxed VM with mocked service-worker globals,
// captures its 'fetch' handler, and dispatches synthetic FetchEvents to
// prove how each kind of request is treated. The one that matters:
// cross-origin requests (the Firebase SDK on gstatic.com, Firestore's own
// *.googleapis.com API) must BYPASS the worker entirely - the handler
// returns without calling event.respondWith(), so the browser fetches
// them straight from the network and nothing cross-origin ever lands in
// the cache. Caching a no-cors cross-origin <script>'s opaque response and
// serving it cache-first forever is what once left `firebase` undefined
// for returning players (every leaderboard write silently skipped) until a
// CACHE_NAME bump wiped it.
//
// Pure static load + synchronous dispatch - no browser, no network, no
// Firebase - so it runs in the cheap meta suite.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, runAll } = require('../lib/harness');

const SW_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://metrordle.com';

// Loads sw.js fresh and returns its registered 'fetch' handler. Every
// global it touches at load time or inside the handler is stubbed; the
// stubs only need to not throw, since these tests assert on whether
// respondWith() was called, not on what response comes back.
function loadFetchHandler() {
  const handlers = {};
  const cacheStub = {
    addAll: function () { return Promise.resolve(); },
    put: function () { return Promise.resolve(); },
    match: function () { return Promise.resolve(undefined); },
  };
  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: function (type, fn) { handlers[type] = fn; },
      skipWaiting: function () { return Promise.resolve(); },
      clients: { claim: function () { return Promise.resolve(); } },
    },
    console: { log: function () {}, warn: function () {}, error: function () {} },
    caches: {
      open: function () { return Promise.resolve(cacheStub); },
      match: function () { return Promise.resolve(undefined); },
      keys: function () { return Promise.resolve([]); },
      delete: function () { return Promise.resolve(true); },
    },
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200, clone: function () { return this; } });
    },
    URL: URL,
    Promise: Promise,
    setTimeout: setTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox, { filename: 'sw.js' });
  assert.strictEqual(typeof handlers.fetch, 'function', 'sw.js should register a fetch handler');
  return handlers.fetch;
}

// Dispatches one synthetic FetchEvent and reports whether the handler
// claimed it via respondWith() (i.e. intercepted it) or let it fall
// through to the network (returned without responding).
function dispatch(fetchHandler, url, opts) {
  opts = opts || {};
  var intercepted = false;
  var event = {
    request: { method: opts.method || 'GET', url: url, mode: opts.mode || 'cors' },
    respondWith: function (p) { intercepted = true; Promise.resolve(p).catch(function () {}); },
    waitUntil: function () {},
  };
  fetchHandler(event);
  return intercepted;
}

async function main() {
  test('cross-origin Firebase SDK (gstatic.com) bypasses the worker - never cached', async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js', { mode: 'no-cors' });
    assert.strictEqual(intercepted, false, 'the gstatic Firebase script must go straight to the network, not through the cache-first branch');
  });

  test("cross-origin Firestore API (*.googleapis.com) bypasses the worker", async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, 'https://firestore.googleapis.com/v1/projects/metrordle/databases/(default)/documents');
    assert.strictEqual(intercepted, false, 'Firestore API GETs must not be cached');
  });

  test('same-origin asset (/shared.js) is still intercepted (cache-first)', async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, ORIGIN + '/shared.js');
    assert.strictEqual(intercepted, true, 'same-origin precached assets must still be served by the worker');
  });

  test('same-origin navigation is still intercepted (network race)', async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, ORIGIN + '/memoria/', { mode: 'navigate' });
    assert.strictEqual(intercepted, true, 'same-origin navigations must still be handled');
  });

  test('a non-GET request is left alone', async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, ORIGIN + '/shared.js', { method: 'POST' });
    assert.strictEqual(intercepted, false, 'non-GET requests are not the worker\'s to handle');
  });

  test('the /healthcheck.json latency probe stays uncached', async () => {
    const h = loadFetchHandler();
    const intercepted = dispatch(h, ORIGIN + '/healthcheck.json');
    assert.strictEqual(intercepted, false, 'the healthcheck probe must do a real network round trip every time');
  });

  const failed = await runAll();
  process.exitCode = failed ? 1 : 0;
}

main().catch(function (err) {
  console.error(err);
  process.exitCode = 1;
});
