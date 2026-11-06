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
