# Sopa de metros (`/sopa-de-metros/`, prototype)

- **`/sopa-de-metros/`** - **prototype**, early word-search (sopa de
  letras - the folder's a pun on it). Not
  linked from any nav, `noindex`, no Firebase/leaderboard
  yet, but precached now (`sw.js`'s own `PRECACHE_URLS`, both the
  directory and its `index.html`, same as the real games) - so a change
  to it needs a `CACHE_NAME` bump, which
  `tests/meta/sw-cache-version.test.js` enforces off that list - a
  standalone playable board, same scaffolding as the real games
  (shared.css/shared.js, the pre-paint theme snippet, `.sign`/`.btn-*`,
  `.notice--success` win banner). A 12×12 grid hides 10 Metro-themed
  Spanish words (uppercase, accent-free so each maps to one cell; 10
  `{word, clue}` pairs drawn from a ~20-pair pool), placed in any of the
  8 directions (forward or reversed), the rest filled with random
  letters - deterministic per day via `createSeededRandom('metrordle-
  sopa-' + dateKey)`, retried with a bumped counter if a word won't fit
  (still a pure function of the day). `placeWord()` samples candidate
  spots and takes the one reusing the fewest already-filled cells
  (short-circuiting on a crossing-free spot), so words overlap as little
  as possible - fewer shared cells, fewer touching words. The player sees only the clues (a
  numbered `.clues` list, an `<ol>`), never the words; each clue is led
  by `.line-bar__badge--sm` roundel(s) (shared.css, colored from
  `MetroShared.LINES`, wrapped in `.clue__lines`). A Pistas clue shows a
  single line - one of the station's own `lineIds`, picked by a per-board
  seeded stream (`salt + '-lines'`, separate from the board-building RNG,
  so it's stable per day and fresh on "Nueva sopa") when a station has
  several - followed by the toponym's meaning, not "estación de la Línea
  N" text; a solved station in Respuestas shows **all** of its lines
  (`entry.lineIds`), since the answer's no longer a secret. The clues sit
  in two numbered, headed lists (`buildClueItem()`/`renderClues()`):
  "Pistas" (unfound clues, original order) and "Respuestas" (solved
  stations, in solve order via `state.foundOrder`), each group hidden
  while its list is empty. Finding a word moves it to Respuestas, shown as
  the revealed word (plain `--ink`, no longer green) in front of its own
  clue - no strike-through. Tap a cell to anchor; an 8-neighbour tap
  locks a direction and extends; each further tap must be the next cell
  in that direction. A run whose letters spell a target word (either
  orientation) locks it green - found words cycle 4 green shades
  (`.cell--g0..g3`), colored once at board-build time (`colorWords()`,
  Welsh-Powell over the word-adjacency graph - two words adjacent when any
  cells are within Chebyshev 1, shared cells included) rather than at
  solve time, so no two touching or crossing words ever share a shade
  regardless of the order they're found (4 shades always suffice for these
  boards), which is what lets you tell contiguous words apart; a
  tap that breaks the line starts a fresh attempt at that cell, and
  re-tapping the live selection cancels it. Progress is a rounded
  "X / 10 palabras" bar (shared.css's own `.progress`) under the intro,
  its small label sitting below the bar; the win banner (`.notice--success`)
  sits just above that bar. Completing the board fires a one-shot
  celebration (`celebrate()`): a burst of 💀 erupts from the progress bar
  and rains over the card, drawn as emoji particles on a page-local
  `.celebration-fx` canvas that covers the `.sign` (pointer-events none).
  It fires only on a live solve (from `markFound`), never on a same-day
  reload of an already-won board, and honors
  `MetroShared.prefersReducedMotion()` (fewer, calmer skulls). Page-local
  for now; a candidate to promote to a shared `MetroShared` helper once a
  second game wants one. Today's board persists its found progress to
  `'metrordle-sopa:' + dateKey` (only the found state - the board itself
  is a pure function of the salt, rebuilt and re-overlaid on reload), so a
  refresh keeps your progress; "Nueva sopa" removes that key and deals a
  fresh random board (itself never persisted). No
  committed test yet (it's a prototype) - validated via a scratchpad
  Playwright solve.
