# Tests

Playwright, no framework beyond `assert` - see `tests/README.md` for
the full breakdown of what each file covers and how to add a check.
`cd tests && npm test` runs everything (~95s).

**Before running tests locally, swap `firebase-config.js`'s real
credentials for fake placeholder ones, then restore and verify
`git diff origin/main -- firebase-config.js` is empty before
committing/pushing - never skip this.** The repo's real project is
live; this sandbox can't reach `gstatic.com`/Firestore at all, which is
itself exercised as the "Firebase unreachable degrades gracefully" case
in every leaderboard test.

**A `page.route('**/shared.js', ...)` patch (the trick every "real
data" leaderboard/admin test uses to fake `getTopLeaderboardScores()`/
`submitLeaderboardScore()`) stops working across a `page.reload()`
unless the context is created with `serviceWorkers: 'block'`.** Every
real page here registers `sw.js`, which precaches `/shared.js` - once
it's installed (may happen mid-test, not just on a later visit), a
reload can be served straight from the service worker's own Cache
Storage instead of hitting the network a second time, which
`page.route()` does not see at all. Symptom: the route handler fires
once (the initial load) and never again, so the reload silently runs
the REAL `shared.js`/Firestore path instead of the patched one -
looks like the patch "didn't take" rather than a caching issue.
Belt-and-suspenders: also set `cache-control: no-store` on the
`route.fulfill()` response, in case regular HTTP caching (unrelated to
the service worker) has the same effect. Only matters for a test that
reloads or re-navigates the same page after registering the route -
a single `goto()` per test (most of this suite) never hits this.
