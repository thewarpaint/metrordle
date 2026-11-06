# Memoria (`/memoria/`)

- **`/memoria/`** - Metrordle: Memoria: a 60-second memory-match game
  pairing station icons with names. Its status strip is the shared
  `.progress` bar (shared.css, same element Sopa de metros uses): the
  track fills with the time remaining and its `.progress__label--split`
  row reads the time left (m:ss) on the left and the pairs matched on the
  right (`renderStatus()`; `formatClock()` formats both the live countdown
  and practice's count-up clock) - this replaced the old bespoke
  `.status-bar`/`.timer-track`. A match deals the refilled pair (and
  reshuffles it into the board, see `shuffleAfterMatch()`) immediately -
  no delay, same as this always worked before the effects below existed.
  The just-matched pair itself gets a brief "you got it!" moment via
  `spawnMatchGhost()`: it clones each matched card exactly where it's
  sitting, pulls the clone out of the grid entirely (`position: absolute`
  on `.station-card--match-ghost`, appended to `#board-wrap` - a sibling of
  `#memo-board`, not a child of it) and lets it pop + fade away
  (`.station-card--match-flash` for the color, `--match-bg`/`--match-ink`
  set inline from the matched station's own line - same colored-by-line
  convention as Metro Crush's board tiles and Metroguessr's reveal badge;
  deliberately color-only, no line-id badge on top the way Metroguessr's
  own hint marker has one - tried, but it read as clutter on a card this
  small) entirely on its own, over `MATCH_FLASH_MS` (200ms), before
  removing itself. The live grid cell underneath is refilled and
  re-rendered in the very same tick, with no flash of its own - just the
  same plain entering pop-in any fresh card gets. This split is
  deliberate, not incidental: animating the *live* cell in place (an
  earlier version of this recolored/relabeled it as the flash faded) read
  as one existing card confusingly changing its own mind rather than a
  clear old-card-leaves/new-card-arrives swap, and the grid's own
  FLIP-diffing (see `renderBoardAnimated()`) only has "existing card
  slides" or "brand new card pops in" to work with - neither can also
  show an old card visibly leaving the very slot a new one is landing in,
  which is exactly why the ghost needs to exist outside the grid's own
  layout flow rather than as a transient state on the cell that slot
  currently holds. A "+1" - colored by that same just-matched line, not a
  flat "success" green - rises and fades over where the match actually
  happened (`showMatchPopup()`, `matchCentroid()` read before the refill
  moves anything), and the reveal screen's own matched-icon grid gets a
  staggered pop-in per cell. Unlike Metro Crush's own swap-slide/
  combo-pop/score-popup work (`bd1949b`) this was ported from - see that
  page's own `popScaleForCombo()`/`showScorePopup()`/`delay()` for the
  pattern this was adapted from, Memoria has no cascade/combo dimension
  to scale a pop against, so its own pop is a single fixed size, not an
  escalating one - and none of this blocks the rest of the board: every
  card, including the two just dealt, stays fully interactive, including
  starting or finishing a second match before the first one's own ghosts
  have finished fading. A plain card selection (no match involved) is
  applied via a dedicated `updateSelectionClasses()` that only toggles
  which card has `.station-card--selected`, rather than routing through
  `renderBoard()`'s full teardown/rebuild of all 16 cards - that full
  rebuild used to destroy and recreate all 16 `<use>`-referenced station
  icons on every single click, which was visibly slow enough to read as
  the icons briefly disappearing. Every test helper/selector touching the
  board (`tests/lib/memoria-helpers.js`) is scoped to `#memo-board` for
  exactly this reason - a ghost clone also carries the plain `.station-card`
  class (for its coloring) but lives outside `#memo-board` entirely, and
  an unscoped `.station-card` query would double-count the station it's
  still fading out on top of. Once a round ends, the reveal screen's own
  "Seguir jugando sin guardar" button (`continuePractice()`) lets a
  player keep matching pairs on the same board with no stakes - a
  `state.status === 'practice'` mode that `onCardClick()`/`renderBoard()`
  treat exactly like `'playing'` for interactivity, but with the real
  round's countdown-driven progress bar/`startTimer()`/`tick()` never
  running again (so `endRound()` can't re-fire and resubmit), replaced by
  the shared `.practice-banner` (shared.css, Metro Crush is its other
  consumer now - shown alongside the progress bar, not instead of it)
  explaining nothing here is saved, and a "Volver al resultado" button
  (`endPractice()`) back to the reveal screen. The progress bar itself stays
  up (its `.progress__track` hidden - no countdown to show - but its split
  label still reading) showing practice's own pair of stats instead of the
  real round's - an elapsed-time clock counting up from `0:00` on its own
  (`continuePractice()`'s own `setInterval(renderStatus, 1000)`, cleared
  again by `endPractice()`) and a pairs-matched count scoped to the
  practice session alone (`state.score` minus the score snapshotted the
  moment practice started), not the real result's own score carried
  forward. The round's real result was already persisted and submitted
  by `endRound()` the instant the 60s ran out; `submitScore()`/
  `persistResult()` are only ever called from there (or from
  `submitScore()`'s own success callback), neither of which practice
  play reaches, so nothing from a practice match ever reaches
  `localStorage` or the leaderboard. `continuePractice()` snapshots the
  just-submitted `score`/`won`/`matchedStations` before switching modes
  (also used as practice's own pairs-matched baseline, above), and
  `endPractice()` restores exactly that snapshot - not whatever those
  happen to be after some practice matches - so the reveal screen a
  player returns to always shows the real submitted result.
