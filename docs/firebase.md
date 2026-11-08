# Firebase: config & Firestore rules

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
  ~50KB, plus `schema`/`createdAt`), `update`/`delete` denied. The client
  prunes old daily-state keys from the snapshot (see `exportLocalData` in
  `shared.js`) so a long-time player's history stays under the cap. Like any
  rules change here it's a **manual deploy and must land before (or with)
  the code** - a `create` with an unexpected key fails `hasOnly` →
  `permission-denied` until the rules ship. Expiry is enforced client-side
  off `createdAt` (~7 days); actually deleting stale tokens (a Firestore
  TTL policy on `createdAt`, or a scheduled cleanup) is a follow-up.
