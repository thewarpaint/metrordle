# Metroguessr (`/metroguessr/`)

- **`/metroguessr/`** - Metrordle: Metroguessr: guess the Metro station
  marked on a Leaflet map (CARTO tiles) in 5 attempts, hinted by
  distance + compass direction after each guess. Has a "normal"/"hard"
  mode toggle (`state.mode`), chosen on a fresh day via the shared inline
  `.start-overlay` over the map (`finishStartingGame(mode)`), same pattern
  as the other games - a `.mode-modal` used to do this (full-screen); the
  overlay replaced it, holding a short instructions paragraph (it names the
  5-guess limit) + the two mode buttons, with the five attempt `.pips`
  already showing up top and the guess `.panel` hidden behind it until a
  mode is picked. There's no in-play "N intentos restantes" readout anymore
  (the old `.status-line` is gone) - the `.pips` carry that. Hard mode locks
  the map (no pan/zoom)
  while playing, same as this game always worked before the split;
  normal mode leaves it free throughout. Either way the map unlocks and
  swaps in the target's real station-icon badge (Metro Crush's
  pictogram style, colored by line) once the round ends. Once the first
  guess is in, a hint button (`🪄`, the `.btn-secondary--sm` outline
  variant next to "Adivinar"'s filled `.btn-primary--sm`) unlocks - up
  to two sequential hints, each burning one
  of the round's 5 attempts like a wrong guess would: the first
  recolors the live marker to the target's real line color AND pins a
  small badge marker (`hintLineMarker`, `.hint-line-badge`) right on
  top of it naming the line's own short id ('4', 'A', '12', ...) -
  color alone isn't accessible, so the number carries the same
  information as text; the second reveals street/place labels early
  (`setLabelsVisible(true)`, otherwise only shown once the round ends).
  `applyHintEffects()` is fully idempotent (always resets the
  marker/badge to baseline before reapplying for the current
  `state.hintsUsed`), which is what makes it safe to reuse as-is across
  a debug date-nav jump between two different days, not just a live
  `useHint()` call or a same-day reload restore. Hints are tracked as
  `state.hintsUsed` (0-2), kept separate from `state.guesses` since a
  hint has no station name/distance of its own and must not show up as
  a fake guess in the history chips or map pins - `state.attempts` is
  `guesses.length + hintsUsed`, and that's what's submitted to the
  leaderboard (not `guesses.length` alone), so a hint-assisted win
  still ranks behind an unassisted one at the same guess count.
  `hintsUsed` is also submitted as its own leaderboard field, purely
  for display - not part of `orderBySpecs` - rendered as one 🪄 per
  hint used, before the existing 🧠 hard-mode flag, in the same
  `.leaderboard__score-badge` slot (widened past shared.css's default
  in this page's own CSS, with `white-space: nowrap` and
  `text-align: right` added, since it can hold up to three emoji on
  one line here and should still sit close to the score number when it
  only holds one or two - `.leaderboard__score`'s own page-local `gap`
  is what keeps a breathing space between the two once the badge itself
  is right-aligned, rather than the badge butting straight up against
  the number). The score itself is a bare digit with no "intento(s)"
  suffix (dropped since the rank/badge/number layout already makes it
  obvious what it counts) in a fixed single-digit-width column, same
  convention as Metrordle's and `/tablero/`'s own leaderboards - together
  with the badge's own fixed width, this lines every row up into a
  table-like grid regardless of how many emoji a given row's badge
  holds.
  Has its own leaderboard (see below) and core-mechanics + leaderboard
  Playwright coverage under `tests/metroguessr/`.
