'use strict';

// Pure git-diff + static-file inspection, no browser/network/Firebase -
// the logic behind the "changed a precached file, forgot to bump
// CACHE_NAME" check (see tests/meta/sw-cache-version.test.js). Kept
// standalone from that test file so the same logic can also be run
// against a synthetic throwaway repo, to prove it actually catches a
// violation rather than only ever having been exercised against this
// real repo's own, already-compliant history.

const { execFileSync } = require('child_process');

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function readFileAtRef(repoRoot, ref, relPath) {
  try {
    return git(repoRoot, ['show', ref + ':' + relPath]);
  } catch (err) {
    return null; // file doesn't exist at that ref (e.g. newly added)
  }
}

// sw.js declares PRECACHE_URLS as a plain string-literal array - pulled
// out with a regex rather than duplicating the list here by hand, so
// this can't quietly drift from sw.js's own list as routes are added or
// removed.
function extractPrecacheUrls(swSource) {
  const listMatch = swSource.match(/var PRECACHE_URLS = \[([\s\S]*?)\];/);
  if (!listMatch) throw new Error('could not find PRECACHE_URLS in sw.js - has its declaration shape changed?');
  const urls = [];
  const entryPattern = /'([^']+)'/g;
  let entryMatch;
  while ((entryMatch = entryPattern.exec(listMatch[1]))) urls.push(entryMatch[1]);
  return urls;
}

function extractCacheName(swSource) {
  const match = swSource.match(/var CACHE_NAME = '([^']+)'/);
  if (!match) throw new Error("could not find CACHE_NAME in sw.js - has its declaration shape changed?");
  return match[1];
}

// '/' and '/laberinto/' both resolve to their own index.html - every
// directory URL in PRECACHE_URLS is always paired with its own
// '.../index.html' entry too, but resolving it here as well means this
// check doesn't silently stop working if that pairing is ever missed.
function urlToLocalPath(url) {
  const relative = url.replace(/^\//, '');
  return relative === '' || relative.endsWith('/') ? relative + 'index.html' : relative;
}

// Merge-base diff (three dots), not a straight two-ref diff - this is
// "what does this branch actually change relative to where it forked
// from base", not "what's different about base since the fork point",
// which would also include every OTHER change that's landed on base
// since (see AGENTS.md's own "Branch off latest main for every change").
function changedFiles(repoRoot, baseRef, headRef) {
  const out = git(repoRoot, ['diff', '--name-only', baseRef + '...' + headRef]);
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

// Returns { touchedPrecached, cacheNameBumped, baseCacheName, headCacheName }.
// touchedPrecached is the list of precached paths (sw.js itself
// included) this diff changed - empty means there's nothing this check
// needs to enforce either way.
function checkCacheVersionBump(repoRoot, baseRef, headRef) {
  headRef = headRef || 'HEAD';

  const headSw = readFileAtRef(repoRoot, headRef, 'sw.js');
  if (!headSw) throw new Error('sw.js not found at ' + headRef);

  const precachedPaths = new Set(extractPrecacheUrls(headSw).map(urlToLocalPath));
  precachedPaths.add('sw.js');

  const touchedPrecached = changedFiles(repoRoot, baseRef, headRef).filter((f) => precachedPaths.has(f));

  const headCacheName = extractCacheName(headSw);
  const baseSw = readFileAtRef(repoRoot, baseRef, 'sw.js');
  const baseCacheName = baseSw ? extractCacheName(baseSw) : null;

  return {
    touchedPrecached: touchedPrecached,
    cacheNameBumped: headCacheName !== baseCacheName,
    baseCacheName: baseCacheName,
    headCacheName: headCacheName,
  };
}

module.exports = {
  checkCacheVersionBump: checkCacheVersionBump,
  extractPrecacheUrls: extractPrecacheUrls,
  extractCacheName: extractCacheName,
  urlToLocalPath: urlToLocalPath,
};
