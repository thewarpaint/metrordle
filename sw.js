'use strict';

// Bump this on every deploy that changes index.html or the precached
// assets below - the version string is what makes the browser notice
// the service worker changed and start the update flow.
var CACHE_NAME = 'metrordle-v31';

// How long a page navigation waits on the network before falling back to
// the cached version - see the fetch handler below.
var NAVIGATION_TIMEOUT_MS = 1500;

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/laberinto/',
  '/laberinto/index.html',
  '/memoria/',
  '/memoria/index.html',
  '/memoria-leaderboard/',
  '/memoria-leaderboard/index.html',
  // Assets
  '/apple-touch-icon.png',
  '/favicon.png',
  '/firebase-config.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/manifest.json',
  '/shared.css',
  '/shared.js',
  '/station-icons.svg',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    // Race the network against a short timeout for the page itself, so
    // online players on a decent connection still get the current
    // version, but a slow network doesn't hold up first paint - the
    // cached copy answers instead. Either way, this network fetch keeps
    // running in the background and updates the cache for next time once
    // it resolves, even after it's lost the race and the cached response
    // has already been sent.
    var networkPromise = fetch(request)
      .then(function (response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(function () {
        return null;
      });

    // Keeps the service worker alive long enough for the cache update
    // above to land even when the timeout below wins the race and
    // respondWith() settles first.
    event.waitUntil(networkPromise);

    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, NAVIGATION_TIMEOUT_MS);
    });

    event.respondWith(
      Promise.race([networkPromise, timeoutPromise]).then(function (response) {
        if (response) return response;

        // Either the network was too slow or it failed outright - serve
        // the last cached version. If there isn't one (e.g. a page not
        // in PRECACHE_URLS on a first-ever visit), wait on the same
        // network fetch that's already in flight rather than starting a
        // second one.
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          return networkPromise.then(function (netResponse) {
            return netResponse || caches.match('/index.html');
          });
        });
      })
    );
    return;
  }

  // Static assets (icons, manifest) rarely change - cache-first.
  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request).then(function (response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
