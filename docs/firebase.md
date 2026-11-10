# Firebase: config & Firestore rules

- **`vendor/firebase/`** - the Firebase compat SDK, **vendored
  same-origin** (`firebase-app-compat.js` + `firebase-firestore-compat.js`),
  loaded by every Firebase page via `<script src="/vendor/firebase/...">`
  instead of the `gstatic.com` CDN. **Why:** ad-blocker filter lists block
  requests to gstatic.com, so the SDK silently never loaded for some
  players (`firebaseDefined:false` → leaderboard writes skipped); a
  same-origin file can't be blocked that way. The files are committed and
  served as-is - the site still has **no build step**; Yarn is only used to
  *refresh* the vendored copy, never at serve time. To update: pin the new
  version in `package.json`, then `yarn install && yarn vendor:firebase`
  (copies the two compat bundles from `node_modules/firebase/` into
  `vendor/firebase/`), and **bump `CACHE_NAME` in `sw.js`** (both files are
  in `PRECACHE_URLS`). Keep the version in sync with whatever the pages
  reference historically (10.13.0). `node_modules/` is gitignored. The
  Firestore API still talks to `*.googleapis.com` at runtime (unavoidable);
  only the SDK *download* is now same-origin.
- **`firebase-config.js`** - **contains the real, live Firebase
  project's credentials on `main`.** See "Firebase credential safety"
  below before ever running tests locally.
- **`firestore.rules`** - hand-maintained, still no CI deploy pipeline -
  either paste it into the Firebase console manually, or (`firebase.json`/
  `.firebaserc` point at the real `metrordle-23704` project already)
  run `firebase deploy --only firestore:rules` locally after `firebase
  login` under your own account. Either way this is a manual, deliberate
  step - nothing in CI runs it automatically, and it's on you to remember
  to actually deploy after a PR that changes this file merges. One
  `match` block per leaderboard collection, validating shape/type/bounds
  only (no login system exists, so these can't verify a human played
  fair - accepted tradeoff for a casual leaderboard).
- **`transfers/{id}`** - a non-leaderboard collection for the PWA
  data-transfer feature (see `docs/systems.md` → "PWA install & data
  transfer"). One doc per snapshot, keyed by a random unguessable id that
  doubles as the user-facing code: `allow read: if true` (read-by-id),
  shape-validated `create` (`data` is a JSON-string snapshot capped at
  ~100KB, plus `schema`/`createdAt`), `update`/`delete` denied. The client
  prunes old daily-state keys from the snapshot (see `exportLocalData` in
  `shared.js`) so a long-time player's history stays under the cap. Like any
  rules change here it's a **manual deploy and must land before (or with)
  the code** - a `create` with an unexpected key fails `hasOnly` →
  `permission-denied` until the rules ship. Expiry is enforced client-side
  off `createdAt` (~7 days); actually deleting stale tokens (a Firestore
  TTL policy on `createdAt`, or a scheduled cleanup) is a follow-up.
