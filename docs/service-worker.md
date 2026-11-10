# Service worker (`sw.js`)

- **`sw.js`** - service worker. Navigations: network race with a
  1.5s timeout, falling back to cache, updating the cache in the
  background regardless of who won the race. Static assets: cache-first.
  **Cross-origin requests bypass the SW entirely** (an early `return` in
  the fetch handler when `request.url`'s origin isn't ours): the Firebase
  SDK from `gstatic.com` and Firestore's own `*.googleapis.com` API always
  go straight to the network. They must never reach the cache-first asset
  branch - a no-cors cross-origin `<script>` yields an *opaque* response
  (status 0, unreadable body), and caching that then serving it cache-first
  forever means one bad opaque fetch (flaky network, captive portal,
  evicted zero-length body) leaves `firebase` undefined for a returning
  player - every leaderboard write silently skipped - until a `CACHE_NAME`
  bump wipes the cache. All of `PRECACHE_URLS` is same-origin, so nothing
  legitimate is lost by skipping cross-origin.
  Per-client freshness tracking keeps a tab's own page and its
  `shared.js`/`shared.css` from diverging in version. **Bump
  `CACHE_NAME` on any change to `sw.js` or any precached asset** -
  check open PRs first for numbering collisions (any two PRs touching
  that line collide on merge regardless of the number picked). Missed
  twice in one session already before `tests/meta/sw-cache-version.test.js`
  started catching it - run as part of `npm test`, so it only reports the
  problem to whoever remembers to run that before pushing (see that
  test's own comment for why it isn't an actual CI gate yet).
  **Every player-facing game route belongs in `PRECACHE_URLS`, both as
  the directory (`/metroguessr/`) and its `index.html`** - Metroguessr
  shipped without either for several PRs before this was caught; when
  adding a new game, add both paths here (and bump `CACHE_NAME`) in the
  same PR that ships it. `/tablero/` is precached too now (though not a
  game route and still unlinked from any game's nav), as is `/juegos/`
  (the player-facing games index) - so a change to `tablero/index.html` or
  `juegos/index.html` needs a `CACHE_NAME` bump like any other precached
  asset, which `tests/meta/sw-cache-version.test.js` now enforces (it
  derives its watched set straight from `PRECACHE_URLS`, and pins
  tablero's membership so dropping it fails loudly). `/design/` and
  `/map/` are still deliberately excluded (not player-facing routes),
  and `/purge/` is excluded because it "must never itself be cached" -
  don't add those. `/status/` is the opposite
  exception - precached on purpose, so it stays reachable offline (see
  its own bullet above) - but `/healthcheck.json`, which that page
  fetches, must stay out of `PRECACHE_URLS` *and* has its own early
  bypass in the fetch handler below, or its whole point (a real,
  uncached network round trip every time) breaks.
