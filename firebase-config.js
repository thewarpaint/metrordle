'use strict';

// Firebase project config for the Metrordle minigame family's daily
// leaderboards (see shared.js's submitLeaderboardScore/
// getTopLeaderboardScores, and firestore.rules for the access-control
// side). This object is safe to expose client-side - it just identifies
// the project, it does not grant access on its own; that's entirely up
// to Firestore Security Rules.
//
// TODO(you): replace every REPLACE_WITH_* value below with your real
// Firebase project's web app config, from the Firebase console under
// Project settings > General > Your apps > Web app. Until then this file
// intentionally does nothing (see the guard below) - the leaderboard
// functions in shared.js already handle Firebase being unavailable by
// failing gracefully, so nothing crashes, the leaderboard section just
// won't show any scores.
var FIREBASE_CONFIG = {
  apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_PROJECT.firebaseapp.com',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID',
};

(function () {
  if (typeof firebase === 'undefined') return;
  if (FIREBASE_CONFIG.apiKey.indexOf('REPLACE_WITH_') === 0) return;

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    // Already initialized, or a malformed config - either way there's
    // nothing more to do here; shared.js's leaderboard functions check
    // firebase.apps.length themselves before touching Firestore.
  }
})();
