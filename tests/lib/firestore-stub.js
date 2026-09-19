'use strict';

// A minimal in-page fake of the Firebase Firestore compat SDK's query
// surface (collection().doc().collection().orderBy().limit().get()) -
// just enough to exercise MetroShared.getTopLeaderboardScores()'s REAL
// query-construction logic in shared.js against realistic Firestore
// query semantics, most importantly the one that silently broke
// /admin/'s Metroguessr leaderboard in production: .orderBy(field)
// EXCLUDES any document missing that field entirely from the results -
// no error, just fewer rows - rather than treating a missing field as
// some default/low value.
//
// This sandboxed test environment can't reach a real Firestore project
// at all (gstatic.com is unreachable), so without this stub,
// getTopLeaderboardScores()'s actual query-building code has never been
// exercised by any committed test - every existing leaderboard test
// only ever reaches its "Firebase unreachable, degrade gracefully"
// early-return branch, which is a real one to keep covering but says
// nothing about whether the query itself is correct.
//
// Installed via route-interception of shared.js (same technique
// tests/admin/admin.test.js's own stubLeaderboardData() uses) so the
// REAL getTopLeaderboardScores() runs, calling into this fake
// window.firebase instead of a replacement for the function itself.

const FIRESTORE_STUB_JS = `
(function () {
  function wrapDocData(raw) {
    var data = Object.assign({}, raw);
    if (typeof data.submittedAt === 'number') {
      var millis = data.submittedAt;
      data.submittedAt = { toMillis: function () { return millis; } };
    }
    return data;
  }

  function makeQuery(docs, orderSpecs, limitN) {
    return {
      orderBy: function (field, dir) {
        return makeQuery(docs, orderSpecs.concat([[field, dir || 'asc']]), limitN);
      },
      limit: function (n) {
        return makeQuery(docs, orderSpecs, n);
      },
      get: function () {
        // The real Firestore behavior under test: a doc missing ANY
        // field named in an active orderBy() clause is dropped
        // entirely, not sorted as if it had a default value.
        var filtered = docs.filter(function (d) {
          return orderSpecs.every(function (spec) { return d.data[spec[0]] !== undefined; });
        });
        filtered.sort(function (a, b) {
          for (var i = 0; i < orderSpecs.length; i++) {
            var field = orderSpecs[i][0];
            var dir = orderSpecs[i][1] === 'desc' ? -1 : 1;
            if (a.data[field] !== b.data[field]) {
              return a.data[field] < b.data[field] ? -dir : dir;
            }
          }
          return 0;
        });
        if (typeof limitN === 'number') filtered = filtered.slice(0, limitN);
        return Promise.resolve({
          forEach: function (cb) {
            filtered.forEach(function (d) {
              cb({ id: d.id, data: function () { return wrapDocData(d.data); } });
            });
          },
        });
      },
    };
  }

  function docsFor(collectionName, dateKey) {
    var byDate = (window.__firestoreStubData || {})[collectionName] || {};
    return byDate[dateKey] || [];
  }

  window.firebase = window.firebase || {};
  window.firebase.apps = [{ name: '[DEFAULT]' }];
  window.firebase.initializeApp = function () {};
  window.firebase.firestore = function () {
    return {
      collection: function (collectionName) {
        return {
          doc: function (dateKey) {
            return {
              collection: function () {
                return makeQuery(docsFor(collectionName, dateKey), [], undefined);
              },
            };
          },
        };
      },
    };
  };
  window.firebase.firestore.FieldValue = { serverTimestamp: function () { return { toMillis: function () { return Date.now(); } }; } };
})();
`;

// dataByCollectionAndDate shape: { [collectionName]: { [dateKey]: [{ id, data }, ...] } }
// - `data` is a plain object of doc fields, `submittedAt` as a plain
// millis number (Firestore Timestamps don't survive JSON.stringify(),
// so the stub above wraps it back into a `.toMillis()`-bearing object
// at read time instead).
async function installFirestoreStub(page, dataByCollectionAndDate) {
  await page.route('**/shared.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = FIRESTORE_STUB_JS + '\n' + body + `
      window.__firestoreStubData = ${JSON.stringify(dataByCollectionAndDate)};
    `;
    await route.fulfill({ response, body: patched });
  });
  // The real Firebase SDK scripts would otherwise clobber the fake
  // window.firebase set up above once they (fail to) load - this
  // sandboxed environment can't reach gstatic.com for them anyway.
  await page.route('**/www.gstatic.com/**', (route) => route.abort());
}

module.exports = { installFirestoreStub: installFirestoreStub };
