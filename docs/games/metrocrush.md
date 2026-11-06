# Metro Crush (`/metrocrush/`)

- **`/metrocrush/`** - Metrordle: Metro Crush: swap two adjacent stations
  to form rows of 3+ of the same line before a 60-second timer runs out,
  Bejeweled-style, with a normal/hard mode toggle (hard hides each
  tile's line color, revealing it only mid-pop) and cascading combos.
  Hard mode also makes the clock elastic, the same mechanic as
  Clasificador's/Copo de nieve's own (`HARD_BONUS_RUN` 3, `state.correctRun`):
  every 3 valid moves in a row add a second, each invalid move subtracts
  one (ending the round if it hits 0), with the shared
  `MetroShared.pulseClock()` +1/−1 cue and `state.secondsWon`/`secondsLost`
  shown as a two-tile `.stat-grid` on the hard-mode reveal (same as the
  other two; `secondsWon`/`secondsLost` persist in the saved result for a
  reload). `.progress__fill` is clamped to 100% since a bonus-fed
  `timeLeft` can run past `ROUND_SECONDS`. Normal mode keeps the flat
  countdown. Its status strip is the shared `.progress` bar (shared.css, same as
  Memoria): the track fills with the time remaining and a three-slot
  `.progress__label--split` row reads the time left (m:ss) on the left,
  points on the right, and the combo toast (`setToast()`) centered
  between them -
  the toast now auto-clears after `TOAST_MS` (5s) instead of lingering
  until the next message. This replaced the old bespoke `.status-bar`/
  `.timer-track`/`.toast`. The strip (track included, filled to 100%)
  renders from the `ready` state on, behind the start overlay, so the
  board doesn't jump down when play begins - `renderStatus()` hides it
  only on the `done` reveal, same fix as Clasificador's own. Once a round
  ends, the reveal's own "Seguir jugando sin guardar" button
  (`continuePractice()`) lets a player keep swapping tiles with no stakes -
  a `state.status === 'practice'` mode that `onTileClick()`, `render()`, and
  the whole cascade (`resolveStep()`/`finishMove()`) treat exactly like
  `'playing'` for interactivity, but with the countdown never running again
  (so `endRound()` can't re-fire/resubmit), replaced by the shared
  `.practice-banner` (see shared.css) and a progress strip showing
  practice's own count-up clock and points-since-starting (`state.score`
  minus a snapshot taken the moment practice began, not the real total). The
  real result was already persisted/submitted by `endRound()` the instant
  the timer hit 0; `continuePractice()` snapshots that submitted
  score/`groupsFormed`/`maxCombo`/`maxRunSeen`/`matchCountsByLine` and
  `endPractice()` ("Volver al resultado") restores exactly it, so nothing
  from practice ever reaches `localStorage` or the leaderboard - same
  pattern as Memoria's own (see its bullet). Unlike Memoria, practice always
  deals a fresh board (the real end-of-round board isn't kept - a saved
  reload only regenerates the deterministic starting one) rather than
  resuming the finished one. Has its own leaderboard (see below), but like
  Metroguessr above, **no committed Playwright tests yet** - only ad-hoc
  scratchpad scripts so far, not `tests/`. Not linked from any other
  game's nav yet.
