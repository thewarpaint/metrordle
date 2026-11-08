# AGENTS.md

Map for picking up work in this repo. This file is the **table of
contents, not the manual**: it holds the handful of rules that bite
mid-task, then points at `docs/`, which is the system of record. Before
changing an area, read its linked doc. If this map and a doc disagree,
the doc wins — fix the stale map.

## What this is

**Metrordle** (metrordle.com): a family of daily Wordle-style minigames
themed around the Mexico City Metro. Static site, **no build step** -
every page is a single self-contained `.html` file with inline
`<style>`/`<script>`, deployed as-is via GitHub Pages (see `CNAME`).
Site copy/UI is in Spanish (`es-MX`) - except `/status/`, an internal
ops page, which is English.

## Global invariants (true everywhere — don't relearn these per task)

- **No build step.** Edit the `.html` files directly; nothing compiles.
  Each game page is self-contained (inline `<style>`/`<script>`).
- **Deterministic per calendar day.** Every game derives its puzzle from
  a seeded RNG (`MetroShared.createSeededRandom('<salt>-' + dateKey)`), so
  everyone gets the same puzzle and replays need a `?debug=true` override.
- **Keep code comments succinct and useful** - explain the non-obvious
  why, not the what, and don't let a comment sprawl past what a reader
  actually needs. (This file and `docs/` prose are the exception - they
  stay thorough; this rule is about `//` / `/* */` comments in the actual
  game/test code.)
- **Put styling shared by 2+ pages in `shared.css`,** never copy-pasted
  per page - check for an existing shared rule first. See `docs/shared.md`.
- **Bump `CACHE_NAME` in `sw.js` on any change to a precached asset**
  (versioned by PR number, e.g. `metrordle-v250`);
  `tests/meta/sw-cache-version.test.js` enforces it. See
  `docs/service-worker.md`.
- **Every leaderboard `alias` render uses `.textContent`, never
  `.innerHTML`** - aliases are arbitrary user text. See `docs/systems.md`
  (Rendering safety).
- **Before running tests, swap `firebase-config.js`'s real credentials for
  placeholders, then restore and verify `git diff origin/main --
  firebase-config.js` is empty before committing.** See `docs/testing.md`.
- **Git:** branch off latest `main`, one PR per logical change, never push
  to `main`; keep commits/PRs/comments succinct; end them with the
  session's attribution footer. See `docs/contributing.md`.

## Map (`docs/` is the system of record)

Read the relevant doc before touching that area. Each game that has its
own folder also carries a one-line `AGENTS.md` pointing back to its doc,
so the right notes surface when you work in that folder.

**Games** (`docs/games/`)
- `docs/games/index.md` - catalog of every game + status
- `docs/games/metrordle.md` - `/` order 5 stations of one line in 5 tries
- `docs/games/laberinto.md` - `/laberinto/` navigate origin → destination
- `docs/games/memoria.md` - `/memoria/` 60s icon↔name memory match
- `docs/games/metroguessr.md` - `/metroguessr/` guess the station on a map
- `docs/games/metrocrush.md` - `/metrocrush/` Bejeweled-style line matches
- `docs/games/clasificador.md` - `/clasificador/` sort stations into lines
- `docs/games/copo-de-nieve.md` - `/copo-de-nieve/` find the odd station
- `docs/games/sopa-de-metros.md` - `/sopa-de-metros/` word search (prototype)
- `docs/games/utility-pages.md` - `/juegos` `/tablero` `/design` `/configurar`
  `/status` `/purge` `/map`

**Shared infrastructure**
- `docs/shared.md` - `shared.js` (the `MetroShared` API + data tables) and
  `shared.css` (design tokens + consolidated component classes and history)
- `docs/service-worker.md` - `sw.js`, `CACHE_NAME`, `PRECACHE_URLS`
- `docs/firebase.md` - `firebase-config.js`, `firestore.rules`, credential
  safety

**Systems & conventions**
- `docs/leaderboards.md` - per-game ranking, high-score records, losses,
  streaks
- `docs/systems.md` - game suggestions, site config (theme/motion/alias),
  debug mode, rendering safety
- `docs/testing.md` - the Playwright suite, the credential swap, the
  `serviceWorkers: 'block'` gotcha
- `docs/contributing.md` - git workflow, `CACHE_NAME` = PR number

`tests/meta/agents-doc.test.js` keeps this map honest (size, resolvable
links, a doc per game).
