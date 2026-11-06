'use strict';

// Keeps AGENTS.md a map, not a manual (see its own header). The repo's
// knowledge lives in docs/ as the system of record; AGENTS.md is a short,
// stable entry point that points there. This guards the three ways that
// arrangement rots: the map growing back into an encyclopedia, links that
// no longer resolve, and docs nothing points at.
//
// Pure file inspection - no browser, no Firebase, no network.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, test, runAll } = require('../lib/harness');

// AGENTS.md is injected into every session's context, so it must stay a
// map. The OpenAI "harness engineering" writeup that motivated the split
// targets ~100 lines; 120 leaves a little headroom without inviting creep.
const MAX_AGENTS_LINES = 120;

const DOCS_DIR = path.join(REPO_ROOT, 'docs');

function read(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); }

function allDocs(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) allDocs(full, acc);
    else if (name.endsWith('.md')) acc.push(path.relative(REPO_ROOT, full));
  }
  return acc;
}

// Every `docs/...md` path mentioned in a markdown file (as a link target or
// inline code), repo-relative.
function docRefs(text) {
  const out = new Set();
  const re = /docs\/[\w./-]+\.md/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[0]);
  return out;
}

test('AGENTS.md stays a map, not a manual (<= ' + MAX_AGENTS_LINES + ' lines)', () => {
  const lines = read('AGENTS.md').split('\n').length;
  assert.ok(
    lines <= MAX_AGENTS_LINES,
    'AGENTS.md is ' + lines + ' lines (max ' + MAX_AGENTS_LINES + ') - move depth into docs/ and leave a pointer'
  );
});

test('every docs/ link in AGENTS.md resolves to a real file', () => {
  const refs = [...docRefs(read('AGENTS.md'))];
  const missing = refs.filter((r) => !fs.existsSync(path.join(REPO_ROOT, r)));
  assert.deepStrictEqual(missing, [], 'dangling docs link(s) in AGENTS.md: ' + missing.join(', '));
});

test('no orphan docs - every docs/*.md is linked from AGENTS.md or docs/games/index.md', () => {
  const linked = new Set([
    ...docRefs(read('AGENTS.md')),
    // docs/games/index.md links by bare filename (metrordle.md), so resolve
    // those against docs/games/.
    ...[...read('docs/games/index.md').matchAll(/\(([\w-]+\.md)\)/g)].map((m) => 'docs/games/' + m[1]),
  ]);
  // The catalog itself is the one doc reached only via AGENTS.md's games list.
  const orphans = allDocs(DOCS_DIR, []).filter((d) => !linked.has(d));
  assert.deepStrictEqual(orphans, [], 'doc(s) nothing links to: ' + orphans.join(', '));
});

test('every game has a doc, and no game doc outlives its page', () => {
  const gamesDir = path.join(DOCS_DIR, 'games');
  const gameDocs = fs.readdirSync(gamesDir).filter((f) => f.endsWith('.md') && f !== 'index.md');
  for (const doc of gameDocs) {
    const slug = doc.replace(/\.md$/, '');
    // metrordle lives at the repo root (index.html); the rest are /<slug>/.
    const pageExists = slug === 'metrordle'
      ? fs.existsSync(path.join(REPO_ROOT, 'index.html'))
      : doc === 'utility-pages.md'
        ? true
        : fs.existsSync(path.join(REPO_ROOT, slug, 'index.html'));
    assert.ok(pageExists, 'docs/games/' + doc + ' has no corresponding page (stale doc?)');
  }
});

(async () => {
  const failed = await runAll();
  process.exitCode = failed ? 1 : 0;
})();
