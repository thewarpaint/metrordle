'use strict';

// Guards against the exact mistake this repo keeps making: a PR changes
// shared.js/shared.css (or any other file sw.js precaches) without
// bumping sw.js's own CACHE_NAME, so returning players keep getting
// served the stale cached copy indefinitely - see AGENTS.md's own
// "Bump CACHE_NAME on any change to sw.js or any precached asset" rule.
// This has already slipped through review twice in one session (the
// streak-badge PR needed a follow-up PR just to bump the version).
//
// Two things live here:
// 1. A real check against THIS repo's own current diff (skipped, not
//    failed, if there's no base ref to diff against - see BASE_REF).
// 2. Self-tests proving checkCacheVersionBump() itself actually catches
//    a violation and doesn't false-positive on an unrelated change -
//    run against a synthetic, throwaway git repo rather than this
//    real one, since this real repo's own history is (hopefully)
//    always compliant and so could never exercise the "should fail"
//    path otherwise.
//
// Pure git-diff + static-file inspection - no browser, no Firebase, no
// network, so this is cheap enough to run on every push/PR (see the
// planned follow-up: wiring this into an actual CI workflow, which this
// repo doesn't have yet).

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { REPO_ROOT, test, runAll } = require('../lib/harness');
const { checkCacheVersionBump } = require('../lib/sw-cache-version');

// Same base this repo's own workflow branches every PR off of (see
// AGENTS.md's "Branch off latest main for every change"). Overridable
// via env var for a CI checkout that fetched the base branch under a
// different local ref name.
const BASE_REF = process.env.SW_CACHE_VERSION_BASE_REF || 'origin/main';

function baseRefExists() {
  try {
    execFileSync('git', ['rev-parse', '--verify', BASE_REF], { cwd: REPO_ROOT, stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function git(repoRoot, args) {
  execFileSync('git', args, { cwd: repoRoot, stdio: 'ignore' });
}

function writeFile(repoRoot, relPath, content) {
  const fullPath = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function commit(repoRoot, message) {
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-q', '-m', message]);
}

// A minimal stand-in for the real sw.js - just enough for
// checkCacheVersionBump()'s own regexes (CACHE_NAME/PRECACHE_URLS) to
// find what they're looking for.
function fakeSwSource(cacheName) {
  return (
    "var CACHE_NAME = '" + cacheName + "';\n" +
    "var PRECACHE_URLS = [\n" +
    "  '/',\n" +
    "  '/index.html',\n" +
    "  '/shared.js',\n" +
    "];\n"
  );
}

// Sets up a throwaway repo with one base commit (sw.js at v1, plus
// index.html/shared.js), returning its path and the base commit's ref -
// each self-test below branches off that same base commit independently
// so they can't interfere with each other.
function makeBaseRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-cache-version-test-'));
  git(repoRoot, ['init', '-q']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Test']);
  writeFile(repoRoot, 'sw.js', fakeSwSource('app-v1'));
  writeFile(repoRoot, 'index.html', 'v1');
  writeFile(repoRoot, 'shared.js', 'v1');
  commit(repoRoot, 'base');
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  return { repoRoot: repoRoot, baseSha: baseSha };
}

async function main() {
  test('a PR that changes a precached file also bumps sw.js\'s own CACHE_NAME', async () => {
    if (!baseRefExists()) {
      console.log('    (skipped: ' + BASE_REF + ' not resolvable in this checkout)');
      return;
    }

    const result = checkCacheVersionBump(REPO_ROOT, BASE_REF, 'HEAD');
    if (result.touchedPrecached.length === 0) return; // nothing precached changed here

    assert.ok(
      result.cacheNameBumped,
      'sw.js precaches ' + result.touchedPrecached.join(', ') + ', which changed in this diff, but ' +
      "CACHE_NAME is still '" + result.headCacheName + "' - bump it (see AGENTS.md's \"sw.js\" bullet) " +
      'so returning players actually pick up the new file(s) instead of the stale cached copy.'
    );
  });

  test('self-test: flags a precached file changing without a CACHE_NAME bump', async () => {
    const { repoRoot, baseSha } = makeBaseRepo();
    try {
      git(repoRoot, ['checkout', '-q', '-b', 'pr-branch']);
      writeFile(repoRoot, 'shared.js', 'v2 - changed the actual behavior');
      // sw.js untouched - CACHE_NAME stays 'app-v1'.
      commit(repoRoot, 'change shared.js without bumping the cache version');

      const result = checkCacheVersionBump(repoRoot, baseSha, 'pr-branch');
      assert.deepStrictEqual(result.touchedPrecached, ['shared.js']);
      assert.strictEqual(result.cacheNameBumped, false, 'should detect that CACHE_NAME did NOT change');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('self-test: passes when a precached file change also bumps CACHE_NAME', async () => {
    const { repoRoot, baseSha } = makeBaseRepo();
    try {
      git(repoRoot, ['checkout', '-q', '-b', 'pr-branch']);
      writeFile(repoRoot, 'shared.js', 'v2 - changed the actual behavior');
      writeFile(repoRoot, 'sw.js', fakeSwSource('app-v2'));
      commit(repoRoot, 'change shared.js and bump the cache version');

      const result = checkCacheVersionBump(repoRoot, baseSha, 'pr-branch');
      assert.deepStrictEqual(result.touchedPrecached.sort(), ['shared.js', 'sw.js']);
      assert.strictEqual(result.cacheNameBumped, true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('self-test: an unrelated, non-precached file change never needs a bump', async () => {
    const { repoRoot, baseSha } = makeBaseRepo();
    try {
      git(repoRoot, ['checkout', '-q', '-b', 'pr-branch']);
      writeFile(repoRoot, 'README.md', 'some docs change');
      commit(repoRoot, 'docs only');

      const result = checkCacheVersionBump(repoRoot, baseSha, 'pr-branch');
      assert.deepStrictEqual(result.touchedPrecached, [], 'nothing precached changed, so there is nothing to enforce');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  const failed = await runAll();
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
