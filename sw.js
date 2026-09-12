'use strict';

// Bump this on every deploy that changes index.html or the precached
// assets below - the version string is what makes the browser notice
// the service worker changed and start the update flow.
var CACHE_NAME = 'metrordle-v37';

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

// Every log line is prefixed '[SW]' so it's easy to filter for in
// DevTools when debugging a report like "this page always serves the
// wrong content" - see the fetch handler below in particular.
function log() {
  console.log.apply(console, ['[SW]'].concat(Array.prototype.slice.call(arguments)));
}

function warn() {
  console.warn.apply(console, ['[SW]'].concat(Array.prototype.slice.call(arguments)));
}

self.addEventListener('install', function (event) {
  log('install start - CACHE_NAME:', CACHE_NAME, '- precaching', PRECACHE_URLS.length, 'URL(s):', PRECACHE_URLS);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        log('install succeeded - all precache URLs cached under', CACHE_NAME);
        return self.skipWaiting();
      })
      .then(function () {
        log('skipWaiting() done');
      })
      .catch(function (err) {
        // cache.addAll() is all-or-nothing - if ANY single URL in
        // PRECACHE_URLS fails to fetch (a transient host hiccup, a typo'd
        // path, etc.), the WHOLE install rejects, skipWaiting() never
        // runs, and this new version never takes over - the browser keeps
        // running whatever service worker (and whatever fetch handler,
        // whatever cached content) it already had, indefinitely, for
        // that visitor specifically. That's a prime suspect for "this one
        // person is stuck seeing stale/wrong behavior forever" reports,
        // so this failure needs to be loud, not silently swallowed.
        warn('install FAILED - this SW version will never activate, the previous one (if any) stays in control:', err && err.message, err);
        throw err;
      })
  );
});

self.addEventListener('activate', function (event) {
  log('activate start - CACHE_NAME:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        log('existing cache keys:', keys);
        var stale = keys.filter(function (key) { return key !== CACHE_NAME; });
        if (stale.length) {
          log('deleting', stale.length, 'stale cache(s):', stale);
        } else {
          log('no stale caches to delete');
        }
        return Promise.all(stale.map(function (key) { return caches.delete(key); }));
      })
      .then(function () {
        return self.clients.claim();
      })
      .then(function () {
        log('activate complete - clients.claim() done, this SW now controls all open clients');
      })
      .catch(function (err) {
        warn('activate FAILED:', err && err.message, err);
        throw err;
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    log('navigate request:', request.url);

    // Race the network against a short timeout for the page itself, so
    // online players on a decent connection still get the current
    // version, but a slow network doesn't hold up first paint - the
    // cached copy answers instead. Either way, this network fetch keeps
    // running in the background and updates the cache for next time once
    // it resolves, even after it's lost the race and the cached response
    // has already been sent.
    var networkPromise = fetch(request)
      .then(function (response) {
        log('navigate network response for', request.url, '- status:', response.status, response.ok ? '(ok)' : '(NOT ok)');
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, responseClone);
          log('navigate cache updated for', request.url);
        });
        return response;
      })
      .catch(function (err) {
        warn('navigate network fetch FAILED for', request.url, '-', err && err.message, err);
        return null;
      });

    // Keeps the service worker alive long enough for the cache update
    // above to land even when the timeout below wins the race and
    // respondWith() settles first.
    event.waitUntil(networkPromise);

    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () {
        log('navigate timeout (' + NAVIGATION_TIMEOUT_MS + 'ms) elapsed before the network responded for', request.url);
        resolve(null);
      }, NAVIGATION_TIMEOUT_MS);
    });

    event.respondWith(
      Promise.race([networkPromise, timeoutPromise]).then(function (response) {
        if (response) {
          log('navigate serving the NETWORK response for', request.url);
          return response;
        }

        // Either the network was too slow or it failed outright - serve
        // the last cached version. If there isn't one (e.g. a page not
        // in PRECACHE_URLS on a first-ever visit), wait on the same
        // network fetch that's already in flight rather than starting a
        // second one.
        return caches.match(request).then(function (cached) {
          if (cached) {
            log('navigate serving the CACHED response for', request.url);
            return cached;
          }

          log('navigate no cache entry for', request.url, '- waiting on the in-flight network fetch');
          return networkPromise.then(function (netResponse) {
            if (netResponse) {
              log('navigate serving the (delayed) NETWORK response for', request.url);
              return netResponse;
            }

            // Nothing cached under this exact request URL AND the network
            // fetch also failed - this is the fallback of last resort.
            // Loud on purpose: if request.url isn't for '/' or
            // '/index.html' itself, this is a page silently rendering as
            // the HOMEPAGE instead of what was actually requested, which
            // reads to a player as "I visited X and got redirected to
            // the index page" even though nothing actually redirected -
            // the address bar never changes, only the served content
            // does. Worth double-checking request.url here for anything
            // that wouldn't have an exact match in PRECACHE_URLS - no
            // trailing slash, a stray query string, etc.
            warn('navigate FALLING BACK TO /index.html for', request.url, '- no cache entry and the network fetch failed. PRECACHE_URLS has:', PRECACHE_URLS);
            return caches.match('/index.html');
          });
        });
      })
    );
    return;
  }

  // Static assets (icons, manifest) rarely change - cache-first.
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) {
        log('asset cache HIT:', request.url);
        return cached;
      }

      log('asset cache MISS, fetching from network:', request.url);
      return fetch(request).then(function (response) {
        log('asset network response for', request.url, '- status:', response.status, response.ok ? '(ok)' : '(NOT ok)');
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(function (err) {
        warn('asset network fetch FAILED for', request.url, '-', err && err.message, err);
        throw err;
      });
    })
  );
});
