# Metrordle (`/`)

- **`/` (`index.html`)** - Metrordle: order 5 stations of one Metro line
  correctly in 5 attempts. Has a "normal"/"hard" mode toggle
  (`state.mode`), chosen on a fresh day via the shared inline
  `.start-overlay` over the board (`beginRound(mode)` - the same pattern
  Metro Crush and Clasificador use), not a full-screen modal. Until a mode is picked, `state.mode` is `null` and
  `state.started` is `false`: the common chrome (title, line badge,
  headsign, status) and the default-layout board render behind the
  opaque overlay, so the page is whole before the choice. A saved or
  `?debug=true` game skips the overlay (starts `started: true` in its
  own mode), same as the old modal was skipped under debug. Its status
  strip is the shared `.progress` bar (shared.css): the track counts down
  the remaining attempts (base `.progress__fill`, a stepwise step per
  guess, not the per-second `.progress__fill--countdown` the timed games
  use) and a two-slot `.progress__label--split` row reads "N intentos"
  (attempts remaining) on the left and one `.attempt-chip` per guess on
  the right - a rounded-corner rectangle showing that guess's "x/5"
  correctness, banded by `chipTone()`: `--danger` red for 0-1 right,
  `--warn` amber for 2-4, `--ok` green for all 5 (`renderStatus()`). This
  replaced the old bespoke `.status-bar`/`.status-bar__text[data-tone]`
  (and the chips' earlier per-correctness `scaleColor()` gradient). The
  win/lose summary lives on the reveal `.notice` banner, so the status
  strip itself no longer turns win/lose-colored.
