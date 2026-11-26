# Sopa de metros (`/sopa-de-metros/`, monthly)

- **`/sopa-de-metros/`** - a **monthly** word-search challenge (sopa de
  letras - the folder's a pun on it). Not yet linked from any nav and
  `noindex`, but precached (`sw.js`'s own `PRECACHE_URLS`, both the
  directory and its `index.html`, same as the real games), so a change to
  it needs a `CACHE_NAME` bump that `tests/meta/sw-cache-version.test.js`
  enforces off that list. Same scaffolding as the real games
  (shared.css/shared.js, the pre-paint theme snippet, `.sign`/`.btn-*`,
  shared `.notice--*` banners) and now the vendored Firebase SDK +
  `firebase-config.js` for its leaderboard.

## Monthly cadence & materialized config

  Unlike the daily games, Sopa de metros runs **one curated board per
  calendar month**. There is **no runtime board generator and no seed**:
  each month's puzzle is a fully **materialized 12×12 letter grid** (12
  strings of 12 chars) stored in the page's `MONTHLY_PUZZLES` map, keyed by
  `'YYYY-MM'`. The active month is `getDateKey(getEffectiveToday())`'s
  `YYYY-MM` prefix (so `?date=` still previews other months), and the `<h1>`
  title derives from it (`Sopa de metros: <mes>`). **To add a month, drop
  its grid into `MONTHLY_PUZZLES`** - that map is the sole source of truth
  for which months have a challenge.
  - A month **with no entry** (or whose grid is missing a word) renders the
    **"sin reto" state**: the board, progress, clue lists, actions, subtitle
    and intro paragraphs are hidden and a `.notice--info` says the challenge
    returns next month. **Under `?debug=true` the game is always shown** - an
    unconfigured active month falls back to the newest configured month
    (`latestConfiguredMonth()`) so the board can still be exercised.
  - The 10 `WORD_POOL` stations are **located in the stored grid at load**
    (`locateWords()`/`findWord()` scan the 8 directions), returning each
    word's cells in `WORD_POOL` order - this drives the found-cell shade
    coloring (below) and, if any word isn't present, flags the config as
    malformed and falls back to the "sin reto" state rather than rendering
    an unsolvable board. The `.line-bar__badge--sm` roundel a Pistas clue
    leads with (one of a station's `lineIds`) is picked from a
    `monthKey + '-sopa-lines'` seeded stream, stable for the month.

## Solve-once lock

  Found progress persists per month to `'metrordle-sopa:' + monthKey`
  (found state + a `leaderboardSubmitted` flag; the grid is a fixed config,
  rebuilt and re-overlaid on reload). This is also the **no-replay lock**: a
  player who already solved a month restores straight into the won state
  (win banner shown, board inert via `onCellTap`'s `state.won` guard) with
  no way to start over. The **"Nueva sopa"** button is a **debug-only**
  (`?debug=true`) override that clears the month's progress and replays the
  **same** board - hidden entirely in normal play.

## Clues, meanings & references

  The player sees only the clues (a numbered `.clues` list), never the
  words; each clue is led by `.line-bar__badge--sm` roundel(s) (colored from
  `MetroShared.LINES`, wrapped in `.clue__lines`). Each station carries one
  or more **senses** (`{meaning, etym, ref}`); a Pistas clue shows the
  meaning(s) joined with "o" (Culhuacán has **two** attested readings -
  "cerro torcido" / "lugar de los que veneran a Coltzin"), on a flex row so
  a wrapped clue stays in its text column. Clues sit in two numbered, headed
  lists (`buildClueItem()`/`renderClues()`): "Pistas" (unfound, original
  order) and "Respuestas" (solved, in `state.foundOrder` order), each group
  hidden while empty. A **solved** station in Respuestas shows **all** its
  lines, the revealed word, each sense's meaning with a `[n]` **citation
  marker**, and a muted **etymology** breakdown line. A "Referencias" list at
  the page bottom (`renderRefs()`) links the full authoritative source per
  `[n]` (mostly the Gran Diccionario Náhuatl, IIB-UNAM). Citations, etymology
  and the Referencias list are rendered **only for solved stations**, so a
  reference URL (which carries the station name) never reveals an unfound
  word.

## Interaction, coloring & celebration

  Tap a cell to anchor; an 8-neighbour tap locks a direction and extends;
  each further tap must be the next cell in that direction. A run spelling a
  target word (either orientation) locks it green - found words cycle 4
  green shades (`.cell--g0..g3`), colored once at load (`colorWords()`,
  Welsh-Powell over the word-adjacency graph - two words adjacent when any
  cells are within Chebyshev 1, shared cells included) so no two touching or
  crossing words share a shade regardless of solve order, which is what lets
  you tell contiguous words apart. A tap breaking the line starts a fresh
  attempt; re-tapping the live selection cancels it. Progress is a rounded
  "X / 10 palabras" bar; the win banner (`.notice--success`) sits above it.
  Completing the board fires a one-shot celebration (`celebrate()`): a burst
  of festive glyphs (🎄 🎁 ⛄ ❄️ ⭐ 🔔, a random one per particle, 100
  particles) erupts from the progress bar over a page-local `.celebration-fx`
  canvas. It fires only on a live solve (from `markFound`), never on a reload
  of an already-won board, and honors `MetroShared.prefersReducedMotion()`.

## Leaderboard (data model)

  Sopa's leaderboard is deliberately unlike the others: it has **no score**,
  only **when** you solved the month's challenge, ranked ascending so the
  earliest solver tops it. Collection
  `sopa-de-metros-leaderboard/{monthKey}/entries/{aliasId}` (monthKey, not a
  dateKey), doc `{ alias, submittedAt }`, `submittedAt == request.time`
  (server-stamped). The `firestore.rules` block is **create-only** (no
  update/delete), so a player's first solve time is locked in and can't be
  pushed later by a resubmit - **a manual Firebase-console deploy that must
  land before/with the code**, like every rules change (see
  `docs/leaderboards.md`). On a live solve `submitScore()` writes the entry
  via `MetroShared.submitLeaderboardScore(..., monthKey, alias, {}, {})` -
  no-op without a site-wide alias (from `/configurar`) or under a `?debug`
  dry-run, guarded by the persisted `leaderboardSubmitted` flag. The page
  renders the standings in a **"Primeros en resolver"** block (shared
  `.leaderboard` markup, below the clue lists): `renderLeaderboard()` fetches
  the earliest `LEADERBOARD_SIZE` solvers
  (`getTopLeaderboardScores(..., [['submittedAt','asc']])`, the player's own
  row pinned in via `myAliasId`) and shows each as rank + alias + the solve
  **date** (`formatSolveDate`, day + short month) - no score column. An
  inline **alias-entry row** (`renderAliasRow()`) appears only to a *solved*
  player with no site-wide alias, so they can claim their spot; a request-id
  guard keeps a slow fetch from painting over the refresh `submitScore()`
  fires on a successful write.
