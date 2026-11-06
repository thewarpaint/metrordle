# Clasificador (`/clasificador/`)

- **`/clasificador/`** - Metrordle: Clasificador: a vertical queue of
  Metro stations (icon + name, same pictogram-on-a-badge convention as
  the other games) stacks above a row of 6 "bucket" badges, one per
  featured Metro line - tap the bucket for the bottom (active) station's
  own line before the 60-second timer runs out. A wrong tap shakes the
  active card in place (`.queue-card--shake`) and flashes the tapped
  bucket red; a correct tap sends a flying ghost clone of the card into
  that bucket (`spawnGhost()`, same split-animation convention as
  Memoria's own `spawnMatchGhost()` - the ghost animates independently
  while the live queue re-renders underneath it) and the queue slides
  down with a new station entering at the top. Its status strip is the
  shared `.progress` bar (shared.css, same two-slot `.progress__label--split`
  shape as Memoria): the track fills with the time remaining and the label
  reads the time left (m:ss) on the left and the classified count on the
  right (`renderStatus()`/`formatClock()`) - this replaced the old bespoke
  `.status-bar`/`.timer-track`. The strip (track included, filled to 100%)
  renders from the `ready` state on, behind the start overlay, so it's
  visible before the round and the queue doesn't jump down when play begins
  - `render()` hides it (track and all) only on the `done` reveal screen,
  not before play (an earlier version hid the track until `playing`, which
  popped it in and shifted the queue). Has its own leaderboard,
  streak, and share text now (see below).

  Both **which 6 of the real 12 Metro lines are featured** and **the
  order stations get dealt in** are fully deterministic per calendar
  day, from a single `MetroShared.createSeededRandom('metrordle-
  clasificador-' + dateKey)` generator consumed in a fixed sequence
  (pick the 6 lines first, then shuffle the day's station pool, then
  reshuffle that same pool - using the SAME generator, not a fresh
  `Math.random()` - every time a 60-second round deals through it more
  than once) - the whole session's dealing order stays a pure function
  of `dateKey`, matching every other game's own single-seed-per-day
  convention. The 6 featured lines are re-sorted back into
  `MetroShared.LINES`' own fixed order after the seeded shuffle picks
  them, so the bucket row always reads left-to-right the way the real
  line numbering does, regardless of which 6 happened to get drawn.
  Picking 6 lines purely at random can land on a heavily-overlapping
  set (several lines sharing the same transfer stations) small enough
  to feel thin - as few as 62 unique stations across all possible
  6-line draws, against an 89.6-station average - so `pickFeaturedLines()`
  keeps re-drawing from that same generator (not a fresh one) until the
  deduplicated pool clears `MIN_STATION_POOL` (80), a single named
  constant kept right next to `FEATURED_LINE_COUNT` for exactly this
  kind of tuning. Re-drawing rather than padding the pool some other
  way (e.g. adding a 7th line, or topping up with extra stations from
  outside the 6) keeps the "always exactly 6 real lines, one bucket
  each" shape intact - a short day just spends a bit more of the same
  seeded generator before settling, still a pure function of `dateKey`.

  A real transfer station that lands on more than one of the day's 6
  featured lines (common - e.g. Pantitlán alone is on 4 of the real 12
  lines) is **never filtered out or forced onto one "canonical" line**:
  it's dealt once with every one of its real lines among today's 6
  recorded as a correct answer (`item.lineIds`, an array, not a single
  id), and tapping any of them counts - credit in `correctByLine` goes
  to whichever bucket the player actually tapped, not a fixed choice.
  This is deliberately NOT the same shape as the per-line "which 6 are
  playable today" filtering decision - the ambiguity is the point of
  the mechanic, not something to design around.

  Like every other game, a finished round persists its result
  (`total`/`correctByLine`/`classified`/`leaderboardSubmitted`) to
  `'clasificador:' + dateKey` and a reload on the same day shows that
  same reveal screen instead of a fresh queue (`loadSavedResult()`/
  `startNewGame()`'s own saved-result branch). The reveal now shows the
  exact stations classified as a colored icon grid (same pattern as Copo/
  Memoria: `.station` tiles filled by the line each was placed into,
  clustered by line then alphabetical, with a staggered pop-in) -
  `classified` = `[{name, lineId}]`, recorded per correct placement in
  `attemptPlace()`; `renderClassifiedStations()`. Saved results from
  before `STATION_LIST_SINCE_DATE_KEY` (`2026-10-27`) predate the
  `classified` field, so their reveal falls back to the old per-line
  `× N` count chips (`renderLineCounts()`) - the cut line gated on
  `state.dateKey`. Now in `SUGGESTABLE_GAMES`
  too (appended after the other five when it shipped; Copo de nieve now
  follows it) - every other game's "sigue jugando hoy" promo can suggest
  it, same as its own reveal screen's promo suggests from the other six.

  Has its own daily `clasificador-leaderboard` collection now (see
  "Leaderboards" below) - ranked by a single descending `score` (the
  round's own `total`), same shape as Memoria's and Metro Crush's own.
  Also tracks a streak (`clasificador:streak`)
  the same way Metro Crush's own does - extended by any round with a
  non-zero score rather than a "won" outcome, since there's no daily
  win/loss puzzle to hook into (see "Streaks" below). The reveal banner
  itself now shows it too (`¡Tiempo! 🔥 Racha: N días` via
  `MetroShared.formatStreak()`, plus a `, máxima: M días` only once
  `state.maxStreak` is actually ahead of today's own `state.streak` -
  `maxStreakLine()`, the same helper/convention as Metro Crush's own)
  - this shipped after the leaderboard/streak-tracking itself did, so
  for a while the streak was tracked and shown in the leaderboard rows
  but never surfaced to the player on their own end screen.

  Also now tracks an all-time high score (`records/clasificador`, same
  `MetroShared.updateHighScoreRecord()`/`getHighScoreRecord()` pattern
  as Memoria's/Metro Crush's own, rendered next to the leaderboard and
  on `/admin/`'s own board the same way too - see "High score records"
  below), seeded from the real leaderboard's own highest entry to date
  rather than starting empty, so it isn't orphaned once a genuinely
  higher score eventually overwrites it.

  Also has a game number now, same `#N` convention as Metrordle/
  Laberinto/Metroguessr/Metro Crush (`MetroShared.getGameNumberForDateKey(
  dateKey, START_DATE_KEY)`, set on `#game-title` in `startNewGame()`'s
  own two branches) - `START_DATE_KEY` is `'2026-10-10'`, the day this
  shipped, so that day is game #1. `/admin/`'s own `startDateKey` for
  this collection was already `'2026-10-10'` from when the leaderboard
  itself shipped (see "Leaderboards" below) - it needed no change here,
  since admin's `#N` badge is computed purely from `startDateKey` and
  today's date, not from anything this game's own page submits. Now also
  in this game's own share text (`buildShareText()`), same `#N` spot as
  Metro Crush's own.

  Share text (`shareResult()`/`MetroShared.shareOrCopyText()`, same
  native-share-with-clipboard-fallback convention as every other game)
  rates the round via a `getRating(score)` open-scale band - "Terrible"
  at 0 up through "Sobresaliente", same label/🟥-🟪 square shape as
  Memoria's/Metro Crush's own `getRating()`, thresholds tuned to how
  many stations a 60-second round here actually tends to classify
  rather than copied from either (there's no per-tap delay once a
  placement lands, so the pace - and the bands - differ from Memoria's
  card-flip-gated one). Shares `state.total`, the rating, and
  `state.streak`/max-streak the same way Metro Crush's own share text
  does.

  Has a normal/hard mode toggle now too, chosen Metro-Crush-style via
  two buttons in the existing `.start-overlay` (`beginRound(mode)`)
  rather than a separate pre-round `.mode-modal`, since this game
  already has a "press start" step to attach the choice to. Hard mode
  keeps the same vertical, one-station-per-row `.queue` list but swaps
  each named `.queue-card` row for a plain `.station-card` icon
  (shared.css), horizontally centered in the row (`.queue--hard`,
  `buildQueueIcon()`) - no name, same icon-only treatment Memoria's own
  cards use - with the active station still the biggest, same role
  `.queue-card--active` plays in the normal-mode list (`buildQueueItem()`
  picks the right builder per `state.mode`; both share a `.queue-active`
  marker class so `attemptPlace()`'s shake/ghost lookups don't need
  their own mode branch). `spawnGhost()`'s fly-to-bucket animation now
  tracks the resolved card's exact left/top/width instead of relying
  on `.queue-ghost`'s own stretched-edge-to-edge CSS, since a hard-mode
  icon ghost is a small centered square, not a full-width row. Submitted
  as `hardMode` alongside `score` (🧠 badge, share text), same as Metro
  Crush's own - not part of `orderBySpecs`, since there's no
  attempts-count tiebreak for it to win at the same score the way
  Metrordle's own hard mode does. Hard mode also makes the 60s clock
  elastic (`HARD_BONUS_RUN`, `state.correctRun` in `attemptPlace()`):
  every 5 correct in a row adds a second, each wrong guess subtracts one
  (ending the round if it hits 0). Normal mode keeps the flat countdown.
  The `.progress__fill` width is clamped to 100% since a bonus-fed
  `timeLeft` can run past `ROUND_SECONDS`.
