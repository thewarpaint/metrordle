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
    console.error('[Firebase] SDK not loaded - firebase-app-compat.js/firebase-firestore-compat.js did not load before this script ran (network blocked? ad blocker? gstatic.com unreachable?).');
    // A <script> onerror is opaque (no status), so re-fetch the SDK to learn
    // more: a blocked request (ad blocker / firewall / offline) rejects with
    // no HTTP status; one the server answered resolves with the real status
    // (gstatic is CORS-enabled). Best-effort - wrapped so it can't break the
    // page.
    try {
      var sdkScript = document.querySelector('script[src*="firebase-app-compat"]');
      var sdkUrl = sdkScript ? sdkScript.src : 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js';
      fetch(sdkUrl, { mode: 'cors', cache: 'no-store' })
        .then(function (res) {
          console.error('[Firebase] SDK probe: ' + sdkUrl + ' answered with HTTP status ' + res.status + ' (type=' + res.type + ') - it reached the browser but did not define `firebase`, so this is a CSP/cache/parse problem, not a network block.');
        })
        .catch(function (err) {
          console.error('[Firebase] SDK probe: the request to ' + sdkUrl + ' FAILED (' + (err && err.name) + ': ' + (err && err.message) + ') - no HTTP status exists: the request was blocked (ad blocker / firewall), refused by CORS, or the network is offline.');
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
