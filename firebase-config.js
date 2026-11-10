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
  apiKey: 'AIzaSyBhSzl62jl7foB-OiF35PCQZk-xBSy7H50',
  authDomain: 'metrordle-23704.firebaseapp.com',
  projectId: 'metrordle-23704',
  storageBucket: 'metrordle-23704.firebasestorage.app',
  messagingSenderId: '123137970314',
  appId: '1:123137970314:web:dd12baa4ebc95f2b55dd73'
};

(function () {
  if (typeof firebase === 'undefined') {
    console.error('[Firebase] SDK not loaded - firebase-app-compat.js did not define `firebase`. It is now vendored same-origin (/vendor/firebase/), so this is a missing file, a stale/broken service-worker cache, or a parse error - no longer an ad blocker on the gstatic.com CDN.');
    // A <script> onerror is opaque (no status), so re-fetch the SDK URL to
    // learn more: a 404 or other server answer resolves with the exact
    // status; an unreachable request rejects with none. Best-effort - wrapped
    // so it can't break the page.
    try {
      var sdkScript = document.querySelector('script[src*="firebase-app-compat"]');
      var sdkUrl = sdkScript ? sdkScript.src : '/vendor/firebase/firebase-app-compat.js';
      fetch(sdkUrl, { cache: 'no-store' })
        .then(function (res) {
          console.error('[Firebase] SDK probe: ' + sdkUrl + ' answered with HTTP status ' + res.status + ' - it reached the browser but did not define `firebase` (a 404, or a cache/parse problem).');
        })
        .catch(function (err) {
          console.error('[Firebase] SDK probe: the request to ' + sdkUrl + ' FAILED (' + (err && err.name) + ': ' + (err && err.message) + ') - no HTTP status exists: unreachable (offline with no cache, or a serving error).');
        });
    } catch (e) {
      // Probe is best-effort diagnostics - never let it throw.
    }
    return;
  }

  console.log('[Firebase] Initializing with config:', FIREBASE_CONFIG);
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('[Firebase] initializeApp() succeeded. firebase.apps:', firebase.apps.map(function (app) { return app.name; }));
  } catch (e) {
    console.error('[Firebase] initializeApp() threw:', e);
  }
})();
