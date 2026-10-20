# AGENTS.md

Context for picking up work on this repo in a new session. Read this
first; it links out to the deeper docs (`tests/README.md`,
`firestore.rules`) rather than duplicating them.

## What this is

**Metrordle** (metrordle.com): a family of daily Wordle-style minigames
themed around the Mexico City Metro. Static site, **no build step** -
every page is a single self-contained `.html` file with inline
`<style>`/`<script>`, deployed as-is via GitHub Pages (see `CNAME`).
Site copy/UI is in Spanish (`es-MX`) - except `/status/`, an internal
ops page, which is English (see its own bullet below).

**Keep code comments succinct and useful** - explain the non-obvious
why, not the what, and don't let a comment sprawl past what a reader
actually needs. (This instruction is itself an exception: AGENTS.md's
own prose stays as thorough as the rest of this file - this rule is
about `//`/`/* */` comments in the actual game/test code.)

## The games

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
- **`/laberinto/`** - Metrordle: Laberinto: navigate from an origin to a
  destination station, picking neighbors/lines at each hop.
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
  a `.practice-banner` (shown alongside the progress bar, not instead of it)
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
- **`/metroguessr/`** - Metrordle: Metroguessr: guess the Metro station
  marked on a Leaflet map (CARTO tiles) in 5 attempts, hinted by
  distance + compass direction after each guess. Has a "normal"/"hard"
  mode toggle (`state.mode`), chosen via a modal on a fresh day, same
  pattern as Metrordle's own - hard mode locks the map (no pan/zoom)
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
  convention as Metrordle's and `/admin/`'s own leaderboards - together
  with the badge's own fixed width, this lines every row up into a
  table-like grid regardless of how many emoji a given row's badge
  holds.
  Has its own leaderboard (see below) and core-mechanics + leaderboard
  Playwright coverage under `tests/metroguessr/`.
- **`/metrocrush/`** - Metrordle: Metro Crush: swap two adjacent stations
  to form rows of 3+ of the same line before a 60-second timer runs out,
  Bejeweled-style, with a normal/hard mode toggle (hard hides each
  tile's line color, revealing it only mid-pop) and cascading combos.
  Its status strip is the shared `.progress` bar (shared.css, same as
  Memoria): the track fills with the time remaining and a three-slot
  `.progress__label--split` row reads the time left (m:ss) on the left,
  points on the right, and the combo toast (`setToast()`) centered
  between them -
  the toast now auto-clears after `TOAST_MS` (5s) instead of lingering
  until the next message. This replaced the old bespoke `.status-bar`/
  `.timer-track`/`.toast`. Has its own leaderboard (see below), but like
  Metroguessr above, **no committed Playwright tests yet** - only ad-hoc
  scratchpad scripts so far, not `tests/`. Not linked from any other
  game's nav yet.
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
  `.status-bar`/`.timer-track`. Has its own leaderboard,
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
  (`total`/`correctByLine`/`leaderboardSubmitted`) to
  `'clasificador:' + dateKey` and a reload on the same day shows that
  same reveal screen instead of a fresh queue (`loadSavedResult()`/
  `startNewGame()`'s own saved-result branch). Now in `SUGGESTABLE_GAMES`
  too (last in priority order, since it shipped last) - every other
  game's "sigue jugando hoy" promo can suggest it, same as its own
  reveal screen's promo suggests from the other five.

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
  Metrordle's own hard mode does.
- **`/admin/`** - read-only cross-game leaderboard browser (not linked
  from any game's nav, `noindex`). Same prev/next date-nav as the
  games' own `?debug=true` mode, gated behind that same param (each
  game's own "Ver este día en ___" deep link too) - shows only today's
  real data otherwise. Two `.stat-grid`/`.stat-box` tiles (shared with
  Metro Crush's own reveal screen - see `shared.css`) above the
  per-game boards: unique aliases across every game that day, and
  total leaderboard entries across every game that day (every
  submitted result, not deduped by alias).
- **`/design/`** - a visual-language reference (not linked from any
  game's nav, `noindex`, same as `/admin/`): side-by-side examples of
  how a Metro line or a station is shown today - most of them still
  competing, un-redrawn copies of each game's own `<style>` block
  (pulled as-is, not hand-approximated), pending a decision; four
  concepts have actually been decided and consolidated already (see
  below). A "Líneas" board (Clasificador's own `.line-bar__badge`,
  Metroguessr's `.hint-line-badge`, plus the already-decided
  `.line-badge` and `.route-dot` - see "Shared infrastructure" below),
  an "Estaciones" board (the already-decided `.station-circle` family -
  Laberinto's transfer-map circles, `--sm` for a line-colored neighbor
  and `--muted` for the soft-inverted current-station hub, promoted from
  Laberinto's own page-local copy; plain text; the
  already-decided `.station-card` (Memoria's own board card); the
  already-decided `.station` (Metro Crush's `.tile`/Metroguessr's
  `.target-icon-marker` - see "Shared infrastructure" below) plus its
  own `.station--chip` size (Metro Crush's `.legend__chip`), and
  Memoria's own `.reveal__icons` - 18 stations across 3 rows of 6,
  mimicking the real end-of-round grid's own size (not just a handful
  like every other example here), using that same plain `.station` -
  a celebratory summary of the lines actually matched,
  deliberately colorful unlike every other "too much color" case this
  file's own consolidation work has trimmed, since it doesn't compete
  with a status/result indicator anywhere else on the page - lives here
  rather than on "Listas de estaciones" below since it's a
  single-station widget shown several times for comparison, same as
  every other example on this board, not a pattern with list structure
  of its own the way the ones below are), and a "Listas de estaciones"
  board for the different ways a GROUP of
  stations gets shown (not a single line or station board, since
  neither fits, and each pattern here has real list structure of its
  own - order, selection, growth - unlike the reveal-grid above):
  Metrordle's
  own `.platform`/`.platform__row` (the puzzle's numbered, reorderable
  guess order - a rank circle whose pill is the raised surface
  (`--paper-raised`, white in light mode) with an `--ink` number, so it
  inverts with the theme (a white pill with a dark number in light mode, a
  dark pill with a light number in dark mode - both themes share one rule
  since both tokens flip) and sits a shade lighter than the `--paper` card
  behind it, a neutral `--ink` icon (was the day's own line
  color, which read as too much color competing with the roundel-row's own
  `.line-badge` above it), a borderless row (the `--paper` fill alone
  sets it off from the sign - the old `--rule-strong` border, black in
  light/white in dark, was dropped), name, and a 🟩/🟥 correctness mark
  once the round ends),
  Clasificador's own `.queue`/`.queue-card` (the upcoming stations
  to classify - unordered, the icon deliberately neutral/un-colored-by-
  line so it can't give away the answer, and borderless (background
  alone sets it off from the card around it), with the one active card
  visually emphasized over the rest), Laberinto's own `.breadcrumb`/
  `.breadcrumb__stop` (the route trail so far, growing left to right -
  plain station names separated by a "→", only the current/last stop
  emphasized, each one now paired with the same small `.route-dot`
  `#optimal-path-list` below uses - `.breadcrumb__stop-group` wraps the
  dot and the name together so a flex-wrap line break can't strand one
  without the other - same no-line-of-its-own-yet origin lookahead too,
  so the live trail and the post-round one read as the same visual
  language rather than the dot being an end-of-round-only idea), and
  Laberinto's own `#optimal-path-list` (the shortest route, shown
  alongside the breadcrumb once the round ends, for comparison against
  the player's own route - numbered with a plain CSS counter rather
  than a rank circle, the counter's own column sized for a 2-digit
  stop number (a route can run past 9 stations) and right-aligned so
  the period before each station name lands in the same spot
  regardless of digit count, each stop paired with the same
  `.route-dot` from "Líneas" reused as a component - the origin has no
  line of its own, so rather than leaving its dot unstyled it borrows
  the very next hop's own line color, same `makeRouteDot(lineId)`
  lookahead on both the live page and this gallery's own sample data),
  and an "Avisos" board for how each game announces the round's own
  result once it ends - success, failure, or just "it's over" for the
  three games with no win/lose outcome to begin with - usually paired
  with that game's own streak. A "Progreso" board shows how in-round
  advancement is surfaced - the shared `.progress` bar in all of its
  usages (✅ consolidado): Sopa de metros's single "N / M palabras"
  label, Memoria's and Clasificador's two-slot `.progress__label--split`
  (time left / pairs or classified count), Metro Crush's three-slot one
  (time / centered combo toast / points), and Metrordle's two-slot one
  (attempts remaining / one colored `.attempt-chip` per guess showing its
  x/5 result, red/amber/green by band, on the base non-countdown fill).

  The `.reveal__banner` card shape is consolidated now: Metrordle's/
  Laberinto's/Memoria's/Metro Crush's own bordered win/lose card and
  Clasificador's own borderless, `--line`-colored flat one were four
  near-identical page-local copies of basically the same "colored
  banner" idea - now one real shared.css class, `.notice` (base shape)
  plus `.notice--success`/`.notice--error`/`.notice--info` (color),
  shown here directly as ✅ consolidado, same as `.line-badge`'s/
  `.station-card`'s/`.station`'s own entries above. The black/white
  border every page but Clasificador's own had (`--rule-strong`) is
  gone entirely - background color alone now carries the result, the
  way Clasificador's already did. `success`/`error` map onto the old
  win/lose; `info` is new - Clasificador's own banner has no win/lose
  outcome to begin with (every round submits regardless of score), so
  it no longer borrows `--line` (the day's own color, which read as
  one more thing competing with the roundel/bucket row's own color);
  a dedicated `--info`/`--info-ink` token pair (shared.css's own
  `:root`, same stable blue as `--focus`) replaces it - deliberately
  **not** aliased to `--line`, since several games reassign that one
  at runtime to the day's own line color, which a neutral "it's over"
  notice should never inherit. Metro Crush's own banner is always
  `.notice--success` (static markup, no JS toggling it - a round there
  never actually loses).

  The banner's own text is a headline (plain win/lose/round-over copy)
  over a smaller, normal-weight line underneath (🔥 plus the streak,
  and the max-streak mention when it's still ahead) - `.notice__title`/
  `.notice__text`, built by one shared `MetroShared.renderNoticeBanner(el,
  variantClass, title, bodyText)` in `shared.js` rather than five
  near-identical `textContent` assignments (one per game). `.notice__title`
  carries no CSS of its own - it just inherits `.notice`'s own size/weight,
  same as the single-line text did before this split; `.notice__text` is
  the one with its own smaller/normal-weight rule. `/status/`'s own
  plain-text notices (see its own bullet above) don't go through this
  helper at all - they're a single line with no title/body split, so
  they still just set `.notice`'s own `textContent` directly.

  Metroguessr's own `.reveal__line`/`.reveal__banner`/`.reveal__station`
  (no card at all - just bold win/lose-colored text sitting inline with
  the station name) joined this consolidation too: it's the shared
  `.notice` now, same as the other five. `#reveal-station` is gone - on
  a **loss**, its station name is folded into `.notice__text` right
  after the streak line ("🔥 Racha: N días. La estación era: X."); on a
  **win** that line is dropped entirely (`showReveal()`'s own comment) -
  the player just guessed the station themselves, so naming it back is
  redundant. `tests/lib/metroguessr-helpers.js`'s own `revealedTarget()`
  no longer reads the banner at all (a win's text doesn't carry the
  station name to read) - it derives the target from the reveal's own
  station-icon badge instead (`window.__mgIconMarkerEl`, set by the
  Leaflet test stub), reverse-looking-up `MetroShared.STATION_ICON_SLUGS`
  from the badge's `<use>` href - a source of truth independent of win/
  loss, and of the banner's own wording either way. (Metrordle's own
  compact status line, once an `.status-bar__text[data-tone]` that turned
  win/lose-colored and was cataloged here via a `.design-notice-status`
  stand-in, is gone - it's now the neutral shared `.progress` bar, see
  the "Progreso" board and Metrordle's own bullet above.)

  A "Formularios" board catalogs buttons/inputs, with the same split as
  every board above: already-consolidated shared.css classes shown
  directly, undecided/page-local ones backed by a `.design-` stand-in.
  `.btn-primary`/`.btn-secondary` (every game's own start/save/share
  button), `.leaderboard__alias` (the alias input+button row every
  leaderboard uses, now also `/configurar/`'s own Alias section), and
  `.mode-modal`/`.mode-option` (Metroguessr's full-screen
  pre-game normal/hard choice - Metrordle used to share it too but now
  uses its own inline `.start-overlay` instead, see its bullet above;
  shown here as just `.mode-modal__card`
  inline - `.mode-modal` itself is `position: fixed`, which would break
  out of the gallery's own layout the way every other example on this
  page stays inline) are all real, already-shared classes - as is
  `.start-overlay__modes` (Metro Crush's, Clasificador's, and Metrordle's
  own two-button pre-round choice): the whole `.start-overlay` family was
  promoted into shared.css once Metrordle became its third consumer (see
  "Shared infrastructure" below), so `/design/` shows the real
  `.start-overlay__modes` directly now (✅ consolidado), not the old
  `.design-overlay-modes` stand-in (removed). The one still-scattered
  form pattern left here is `.mode-option[aria-pressed="true"]`
  (`/configurar/`'s own persistent-selection override on the same
  `.mode-option` the modal above uses - `.design-option-pressed` stands
  in for it, since no game loads that page-local override on `/design/`).
  These three pre-game choices aren't competing alternatives for the same
  concept - they're genuinely different shapes (a dismiss-once modal vs.
  a two-button overlay group vs. a picker that stays showing the current
  choice) that happen to share `.mode-option`/the buttons as their base,
  surfaced here specifically because nothing elsewhere in this file had
  cataloged the overlap before. A second-pass audit added the form controls the first pass
  missed, chiefly Metroguessr's own: `.btn-primary--sm`/
  `.btn-secondary--sm` (the shared small button variants - "Adivinar"
  is the filled primary, the hint button the outline secondary; both
  were once a bespoke page-local `.guess-btn` with its own asymmetric
  Metro corner, consolidated into real `.btn-primary`/`.btn-secondary`
  size modifiers: shorter, smaller text, but the same all-4 rounded
  corners; shown ✅ consolidado, no stand-in) and its search
  field, now the shared `input[type="text"]` too (every text input
  site-wide shares one look - the buttons' 0.5rem corner radius and a
  slightly bigger text; the alias input is the same style now), with
  only its `.suggestions`/`.suggestion` autocomplete dropdown still
  page-local (shown via the `.design-suggestions`/`.design-suggestion`
  stand-ins, static rather than the live `position: absolute`
  pop-over). Also `.map-maximize-btn` (its
  round map-maximize icon button, `position: fixed` on the live page;
  `.design-map-maximize-btn` stands in). Two shared.css primitives the
  first pass also skipped are shown directly (✅ consolidado, no
  stand-in): `.btn-secondary--chev`/`.btn-secondary--chev-sm` (the
  `?debug=true` date-nav chevrons every game and `/admin/` use - a
  square icon variant of `.btn-secondary`, see "Shared infrastructure"
  below) and `.debug-mode-toggle` (the small normal/hard toggle on that
  same debug row). `.btn-secondary--chev` gets a second example too, for
  Metrordle's own per-row station-reorder controls, which reuse it: a
  ▲▼ pair (full-size `.btn-secondary--chev`, in `.platform__buttons`) to
  move a station up/down in normal mode, and a ◀▶ pair
  (`.btn-secondary--chev-sm`, in `.platform-icon-col__nav`) to move it
  left/right in hard mode - the button is the shared class, only the
  flex wrappers are page-local.
  Still-undecided patterns are backed by a design-reference section in
  `shared.css` (search for the `.design-` prefix) that exists purely to
  give this page something real to show for those - no game references
  those particular classes. This section is meant to shrink as each
  individual concept gets decided (see `.line-badge`'s, `.station-card`'s,
  and `.station`'s own comments, right above it, for the three that
  already did) - not grow once something's settled, though cataloging a
  genuinely new, previously-unsurfaced pattern (like the two above) is
  exactly this page's own job, not a regression of that goal. Colors come
  from `MetroShared.LINES`/`STATION_ICON_SLUGS` at render time (via CSS
  custom properties - `--badge-bg`/`--badge-ink`, the same convention
  every consolidated class now shares) rather
  than being hand-copied, so the examples can't silently drift from the
  real palette. Deliberately left out of `sw.js`'s own `PRECACHE_URLS`,
  same reasoning as `/admin/`'s own exclusion (not a player-facing game
  route).
- **`/configurar/`** - site-wide settings page, linked from every game's
  header (a small ⚙️ in `.brand`, or `.topbar` for Metroguessr's own
  layout) via `.brand__settings`/`.topbar__settings`. For now just a
  Claro/Oscuro/Sistema appearance picker - see "Site config" below for
  the storage/theming mechanism, meant to grow more settings later
  without a new page or a new localStorage key.
- **`/status/`** - a read-only ops health check (not linked from any
  game's nav, `noindex`, same as `/admin/`/`/design/`), but unlike
  those two, deliberately precached (`sw.js`'s own `PRECACHE_URLS`) so
  it's reachable even when the network is the very thing being
  diagnosed. An internal/ops page, not player-facing, so its copy is
  English - the one page on the site that isn't es-MX. Shows which
  `CACHE_NAME` is actually populated in this
  browser right now (`caches.keys()` - the simplest honest answer to
  "what version is this tab running," no page/service-worker message
  round trip needed), then runs two live checks: a fetch of
  `/healthcheck.json` (a static, hardcoded `{"status":"ok"}` file at
  the repo root) and a real Firestore read of `records/memoria` (already
  seeded - see "High score records" below), each timed with
  `performance.now()` and rendered as a green `.notice--success` or red
  `.notice--error` with its own latency in ms. `/healthcheck.json` is
  deliberately excluded from `PRECACHE_URLS` *and* given its own early
  bypass in `sw.js`'s fetch handler (`pathname === '/healthcheck.json'`
  returns before the cache-first asset branch runs) - without both, the
  first request would populate Cache Storage and every later check
  would read a near-0ms cache hit instead of a real network round
  trip, defeating the whole point of measuring latency. The Firestore
  check deliberately doesn't reuse `shared.js`'s own
  `getHighScoreRecord()` - that helper swallows every failure into a
  plain `null` (see its own comment), which is exactly backwards for a
  page whose job is to surface a real failure as red rather than quietly
  degrade. A "Recheck" button re-runs both checks on demand.
- **`/purge/`** - a recovery page that clears Cache Storage + unregisters
  the service worker, then redirects home. Deliberately self-contained
  (no `/shared.js`/`/shared.css` dependency), since it exists to recover
  from a *broken* cache.
- **`/map/`** - an internal diagnostic page (not linked from any game's
  nav, `noindex`, not precached - same as `/admin/`/`/design/`; English
  copy like `/status/`). Plots every `MetroShared.STATION_COORDS` station
  on the same OpenFreeMap/Leaflet map Metroguessr uses, draws each
  `MetroShared.LINES` line as a polyline through its stations in the
  line's color (so a bad coordinate visibly spikes off its line), and a
  side panel auto-flags station pairs under 200m apart (the San Cosme/
  Revolución class of bug - two distinct stations on the same point) and
  any line whose stations are missing coordinates (currently Línea 12).
  Built to catch exactly the kind of data error reported for Metroguessr
  #29. Fully interactive (pan/zoom/search), unlike Metroguessr's locked
  game map.
- **`/sopa-de-metros/`** - **prototype**, early word-search (sopa de
  letras - the folder's a pun on it). Not
  linked from any nav, `noindex`, not precached, no Firebase/leaderboard
  yet - a standalone playable board, same scaffolding as the real games
  (shared.css/shared.js, the pre-paint theme snippet, `.sign`/`.btn-*`,
  `.notice--success` win banner). A 12×12 grid hides 10 Metro-themed
  Spanish words (uppercase, accent-free so each maps to one cell; 10
  `{word, clue}` pairs drawn from a ~20-pair pool), placed in any of the
  8 directions (forward or reversed), the rest filled with random
  letters - deterministic per day via `createSeededRandom('metrordle-
  sopa-' + dateKey)`, retried with a bumped counter if a word won't fit
  (still a pure function of the day). The player sees only the clues (a
  numbered `.clues` list, an `<ol>`), never the words; finding a word
  reveals it (green) in front of its own clue, sinks that clue to the
  bottom of the list (in solve order, tracked by `state.foundOrder`) and
  strikes through the clue text - but NOT the just-revealed word, which
  stays as the green answer. Tap a cell to anchor; an 8-neighbour tap
  locks a direction and extends; each further tap must be the next cell
  in that direction. A run whose letters spell a target word (either
  orientation) locks it green - found words cycle 3 green shades,
  assigned greedily so a word never shares a shade with one it
  touches/crosses, which is what lets you tell contiguous words apart; a
  tap that breaks the line starts a fresh attempt at that cell, and
  re-tapping the live selection cancels it. Progress is a rounded
  "X / 10 palabras" bar (shared.css's own `.progress`) under the intro,
  its small label sitting below the bar; the win banner (`.notice--success`)
  sits just above that bar. Today's board persists its found progress to
  `'metrordle-sopa:' + dateKey` (only the found state - the board itself
  is a pure function of the salt, rebuilt and re-overlaid on reload), so a
  refresh keeps your progress; "Nueva sopa" removes that key and deals a
  fresh random board (itself never persisted). No
  committed test yet (it's a prototype) - validated via a scratchpad
  Playwright solve.

Each game is deterministic per calendar day: a seeded RNG
(`MetroShared.createSeededRandom('<salt>-' + dateKey)`) derives that
day's puzzle from the date, so everyone gets the same puzzle and replays
are impossible without a debug override.

## Shared infrastructure

- **`shared.js`** - `window.MetroShared`: date-key/seeded-RNG helpers,
  streak tracking (localStorage, also submitted to each game's own
  leaderboard for `/admin/`'s 🔥 display - see "Streaks" below), alias
  helpers, the leaderboard API (`submitLeaderboardScore`/
  `getTopLeaderboardScores`, collection- and field-shape-agnostic - see
  "Leaderboards" below), clipboard/share
  helpers (`shareOrCopyText`, native `navigator.share` with a
  clipboard-copy fallback), `buildGamePromo(currentGameKey,
  dateKey)` for the "sigue jugando hoy" component on every game's own
  end screen (see "Game suggestions" below), `renderNoticeBanner(el,
  variantClass, title, bodyText)` for every game's own end-of-round
  `.notice` banner (see `/design/`'s own "Avisos" bullet above), and
  the site-wide config object (`loadConfig`/`saveConfig`/`getThemeMode`/
  `applyThemeMode`/`setThemeMode` - see "Site config" below). The shared
  data tables also live here: `LINES` (per-line station order + colors),
  `STATION_ICON_SLUGS` (station -> pictogram), and `STATION_COORDS`
  (`[name, lat, lng]` for Metroguessr's map and `/map/` - moved out of
  `metroguessr/index.html` so both read the exact same recorded data;
  Línea 12 isn't in the source dataset yet).
- **`shared.css`** - design tokens (`:root` custom properties, light +
  dark via `prefers-color-scheme` and `[data-theme]`), the embedded
  Overpass font (base64 `@font-face`, huge single line - don't `cat`
  the whole file), and cross-game primitives (`.wrap`, `.brand`,
  `.sign`, `.date-debug` date-nav (its chevrons are
  `.btn-secondary--chev`, below), `.debug-mode-toggle`,
  `.mode-modal`/`.mode-option*` pre-game normal/hard choice (Metroguessr)
  and the lighter inline `.start-overlay`/`__panel`/`__text`/`__modes`
  that covers a game's own board until play begins - a normal/hard choice
  via `__modes` (Metrordle, Metro Crush, Clasificador) or just a single
  "Comenzar" button (Memoria, which has no mode toggle). Each supplies the
  positioned parent it covers; Metro Crush and Memoria also override the
  background to the inset `--paper-well` shade (the shared default is
  `--paper-raised`, which already matches Metrordle's/Clasificador's own
  `.sign`),
  `.btn-primary`/`.btn-secondary` (sharing one box-geometry rule so the
  two stand the same height side by side; they differ only in fill/
  weight/spacing) plus `.btn-primary--sm`/`.btn-secondary--sm` (one
  shorter, smaller-text size modifier for each, same all-4 rounded
  corners - Metroguessr uses the primary for "Adivinar" and the
  secondary for its hint button) and `.btn-secondary--chev`/
  `.btn-secondary--chev-sm` (a square icon variant of `.btn-secondary`,
  consolidating the old standalone `.chev`/`.chev--compact` - every
  `?debug=true` date-nav's left/right arrows and Metrordle's own per-row
  reorder up/down/left/right; `aspect-ratio: 1` keeps it square off the
  `height` alone. The arrow is an equilateral CSS triangle - a `::before`
  with a `clip-path` polygon, 50% of the button wide with its height set
  per orientation so the triangle is equilateral (taller box for the
  left/right arrows, shorter for up/down), filled with `currentColor` and
  centered by the button's flex, pointed by a `data-chev` of
  `left`/`right`/`up`/`down` - deliberately not a ◀/▶ text glyph, since
  those have an emoji-presentation variant some platforms render in
  color. `--chev-sm` is the compact size), one shared `input[type="text"]` rule
  (every text field site-wide - the alias rows and Metroguessr's search
  box - shares it: the buttons' own 0.5rem corner radius and a slightly
  bigger text, so fields and buttons read as one system; only width/
  flex sizing stays per-context), `.leaderboard*` including the
  `.leaderboard__score-badge` hard-mode 🧠 flag, `.line-badge` - a line
  indicator, colored by line via `--badge-bg`/`--badge-ink` falling
  back to the site-wide `--line`/`--line-ink` tokens, used by
  Clasificador's own classification buttons and by Metrordle's own
  line-of-the-day indicator - the first pattern `/design/`'s own
  catalog actually settled on, see its own comment in `shared.css` and
  `/design/`'s own bullet above; `.station-card` - a neutral station
  card, same square-with-rounded-top-right-corner shape as `.line-badge`
  but uncolored and borderless (just `--paper-well` for the background,
  no line, no border - the border was dropped after promotion, so
  Memoria's own page-local interaction states no longer recolor one
  either), promoted from Memoria's own `.memo-card` (gone now) - the
  second settled pattern, and the first shared class under the new
  `station-` prefix (mirroring `line-` for line-related elements) for
  station-related ones. Memoria still owns every interaction state
  layered on top (hover/selected/entering/match-flash/match-ghost/
  empty, cursor/transition) in its own `<style>` block, same split as
  `.line-badge`'s own page-local states in Clasificador; `.station` -
  same square-with-rounded-top-right-corner shape, filled with
  `--badge-bg`/tinted via `--badge-ink` (falling back to a solid `--ink`
  background with `--paper` icon) - the third settled pattern, coalescing
  4 near-identical copies: Metro Crush's own `.tile` AND `.legend__chip`
  (its own `--tile-bg`/`--tile-ink`/`--chip-bg`/`--chip-ink` custom
  properties all renamed to the shared `--badge-bg`/`--badge-ink` to
  match), Metroguessr's own `.target-icon-marker`, and Memoria's own
  `.reveal__icon-cell` (was a neutral cell with just a colored border,
  now filled like the others). Each keeps its own class as a page-local
  modifier for its own states/animations (Metro Crush's many `.tile--*`
  interaction/animation modifiers in particular, its `.tile--neutral`
  hard-mode/preview state now setting its own explicit `--paper-well`
  background rather than relying on `.station`'s own dark fallback,
  which it can no longer count on going unused), same split as
  `.line-badge`'s/`.station-card`'s own. `.station--chip` is the one
  size modifier - just a smaller fixed container (1.8rem) for
  `.legend__chip`'s own pre-round legend/reveal match-summary use, same
  icon proportion as the default size - added once `.legend__chip`'s
  own join into `.station` surfaced a real bug its own CSS had been
  masking: `.legend__chip svg { height: 60%; width: 60% }` (same
  specificity as shared.css's own `.station__icon svg`, loaded after
  it) was *also* matching the very same `<svg>` `makeStationIcon()`
  already wraps in a 60%-sized `.station__icon` span, shrinking the icon
  to 60% of 60% and reading as off-center - gone now that `.legend__chip`
  carries no sizing of its own at all, same as every other `.station`
  consumer. A `.station--sm` modifier existed briefly too (Memoria's own
  reveal grid, a fixed 1.1rem icon rather than a proportional one, since
  its much smaller/denser cells made a proportional icon read as
  cluttered at the time) - gone now: an audit of every real `.station`
  consumer's actual rendered icon-to-container ratio (prompted by that
  same reveal grid visibly reading smaller than Memoria's own live board)
  found `.station--sm` the one inconsistent outlier (34.4%, against
  60% everywhere else, including Memoria's own board which is a
  different class, `.station-card`, at 37.7% - left alone, since its
  cards hold a name label too, not just an icon) - simpler to size
  `.station__icon` itself up to a single shared `66%` (every consumer,
  `.station--sm` included) than to keep carrying a per-consumer
  exception. `.station__icon` is the shared icon wrapper every consumer
  now uses, including Metroguessr's own (a `<span>` now wraps the station
  pictogram `<svg>` it appends to the marker element, where it used to
  append the bare `<svg>` directly - see `tests/lib/leaflet-stub.js`'s
  own token-based `className` match, no longer an exact-equality one,
  for why)). A fifth pattern joined these: `.route-dot` (Laberinto's
  small line-color dot, no text or icon - the per-stop indicator in
  both `.breadcrumb` and `#optimal-path-list`), consolidating the live
  page's own copy with `/design/`'s own `.design-line-dot` stand-in
  into one real class, colored the same `--badge-bg` way as the other
  four. `.route-dot--muted` is its one modifier - a hop with no line to
  show at all, in practice unreachable now that the origin borrows the
  next hop's own color instead (see `makeRouteDot(lineId)`'s own
  comment in `laberinto/index.html`). A sixth pattern joined these:
  `.notice`/`--success`/`--error`/`--info` (end-of-round banner -
  Metrordle's/Laberinto's/Memoria's/Metro Crush's own bordered win/lose
  card and Clasificador's own borderless, day's-line-colored flat one,
  four page-local copies of the same idea now one shared class, border
  dropped entirely - see `/design/`'s own "Avisos" bullet above for the
  full history). A seventh pattern joined these: `.station-circle`
  (Laberinto's transfer-map markers - a filled circle whose border
  matches its own fill, so a neighbor `<button>`'s default border never
  shows; base size is the hub, `--sm` a line-colored neighbor, and
  `--muted` the current-station hub - a soft invert of the old neutral
  circle, filling the old border color `--rule-strong` with the old
  background `--paper-raised` as the icon color). Promoted from
  Laberinto's own page-local copy into `shared.css` so it sits with the
  rest of the station family and is cataloged in `/design/`, even though
  Laberinto is its only consumer so far; `.map-hub`/`.map-node` stay
  page-local for positioning/interaction. `.progress`/`__label`/`__count`/
  `__track`/`__fill` (a rounded `--paper-well` track with an `--ok` fill,
  over a small label) also live here now, cataloged in `/design/`'s own
  "Progreso" board - Sopa de metros uses it for "N / M palabras", and
  Memoria, Clasificador, Metro Crush and Metrordle for a
  `.progress__label--split` row (flex space-between): Memoria's and
  Clasificador's two slots (time left / pairs or classified count), Metro
  Crush's three (time left / centered combo toast / points), and
  Metrordle's two (attempts remaining / one colored per-guess x/5 chip,
  red/amber/green by band). Those chips are the shared `.attempt-chips`/
  `.attempt-chip` + `--bad`/`--mid`/`--good` band classes, living here too
  (next to `.progress__fill--countdown`) since `/design/`'s own Progreso
  board renders the real classes - Metrordle is their only consumer so far,
  but the band tokens (`--danger`/`--warn`/`--ok`) are site-wide and the
  design page shows them directly, so page-local was the wrong home.
  `.progress__fill--countdown` is the one fill
  modifier - a
  1s-linear glide for a once-a-second countdown (Memoria, Metro Crush,
  Clasificador), vs the base 0.3s ease that suits a stepwise count (Sopa's
  words, Metrordle's per-guess attempts). Only each page's `.progress`
  wrapper padding/placement and Metro Crush's own centered `.toast` deltas
  stay page-local. Game-specific CSS
  (including a game's own leaderboard sizing deltas, if any) lives in
  that page's own `<style>` block - **put any styling shared by 2+
  pages in `shared.css`, not copy-pasted per page** (this has already
  happened more than once - check for an existing shared rule before
  adding a new page's version of something another game already has).
- **`firebase-config.js`** - **contains the real, live Firebase
  project's credentials on `main`.** See "Firebase credential safety"
  below before ever running tests locally.
- **`firestore.rules`** - hand-maintained, still no CI deploy pipeline -
  either paste it into the Firebase console manually, or (`firebase.json`/
  `.firebaserc` point at the real `metrordle-23704` project already)
  run `firebase deploy --only firestore:rules` locally after `firebase
  login` under your own account. Either way this is a manual, deliberate
  step - nothing in CI runs it automatically, and it's on you to remember
  to actually deploy after a PR that changes this file merges. One
  `match` block per leaderboard collection, validating shape/type/bounds
  only (no login system exists, so these can't verify a human played
  fair - accepted tradeoff for a casual leaderboard).
- **`sw.js`** - service worker. Navigations: network race with a
  1.5s timeout, falling back to cache, updating the cache in the
  background regardless of who won the race. Static assets: cache-first.
  Per-client freshness tracking keeps a tab's own page and its
  `shared.js`/`shared.css` from diverging in version. **Bump
  `CACHE_NAME` on any change to `sw.js` or any precached asset** -
  check open PRs first for numbering collisions (any two PRs touching
  that line collide on merge regardless of the number picked). Missed
  twice in one session already before `tests/meta/sw-cache-version.test.js`
  started catching it - run as part of `npm test`, so it only reports the
  problem to whoever remembers to run that before pushing (see that
  test's own comment for why it isn't an actual CI gate yet).
  **Every player-facing game route belongs in `PRECACHE_URLS`, both as
  the directory (`/metroguessr/`) and its `index.html`** - Metroguessr
  shipped without either for several PRs before this was caught; when
  adding a new game, add both paths here (and bump `CACHE_NAME`) in the
  same PR that ships it. `/admin/` and `/purge/` are deliberately
  excluded (not linked from any game's nav, and "must never itself be
  cached," respectively) - don't add those. `/status/` is the opposite
  exception - precached on purpose, so it stays reachable offline (see
  its own bullet above) - but `/healthcheck.json`, which that page
  fetches, must stay out of `PRECACHE_URLS` *and* has its own early
  bypass in the fetch handler below, or its whole point (a real,
  uncached network round trip every time) breaks.

## Leaderboards

Each game has its own daily Firestore leaderboard:
`{collection}/{dateKey}/entries/{aliasDocId}`, collections
`metrordle-leaderboard` / `laberinto-leaderboard` / `memoria-leaderboard` /
`metroguessr-leaderboard` / `metrocrush-leaderboard` /
`clasificador-leaderboard`.
Alias is a free-text nickname (site-wide `metrordle:alias` localStorage
key, shared across all games), changeable from `/configurar/` (see
"Site config" below) - but still no way to carry old entries forward
when you do: the alias *is* the document ID (lowercased), so renaming
only changes what *future* submissions use, leaving every
already-submitted entry under the old alias orphaned, permanently
(nothing re-keys past documents - there is no bulk-rename operation on
Firestore data here). Two players choosing the same alias still
silently share/overwrite one entry too (both known, accepted
limitations).

Per-game conventions, each with its own ranking rule baked into
`orderBySpecs` (an ordered `[field, 'asc'|'desc']` list; `submittedAt`
asc is always the final tiebreak). **Only `orderBySpecs[0]` is ever
passed to Firestore's own `.orderBy()`** - `getTopLeaderboardScores()`
fetches ordered (and capped) by that one field alone, then applies the
*whole* `orderBySpecs` list (plus the `submittedAt` tiebreak) itself
client-side via `compareByOrderSpecs()`. This is deliberate, not an
optimization to undo: Firestore's `.orderBy(field)` silently **excludes**
any document missing that field from the query's results entirely (no
error, just fewer rows) - ordering server-side by every field in
`orderBySpecs` would silently drop any entry submitted before a later
field existed on that collection. This isn't hypothetical - it's
exactly what broke `/admin/`'s Metroguessr leaderboard the day
`hardMode` was added to its `orderBySpecs`: every entry from earlier
that same day (before that field existed on writes) vanished from
every query ordering by it, with nothing visibly erroring anywhere.
**Adding a new field to an existing collection's `orderBySpecs`
requires no code changes to stay safe** (the split above already
handles it, and `compareByOrderSpecs()` treats a missing field as
`false`/`0` rather than crashing) - just be aware that any entry
submitted before that PR won't have the new field, and will rank
accordingly (lowest) until/unless it's backfilled. `orderBySpecs[0]`
itself doesn't have this risk, since it's each collection's original
ranking field, present since the collection was created.

A field that's purely informational - rendered somewhere, never
sorted/tie-broken on (Metroguessr's own `hintsUsed`/🪄 badge, every
game's `streak`/🔥 one, see below) - should almost never go in
`orderBySpecs` at all, exactly to sidestep the exclusion risk above.
But `getTopLeaderboardScores()` only ever copies `orderBySpecs` fields
(plus `id`/`alias`/`submittedAt`) from the Firestore document into the
entry object it hands back - **a field left out of `orderBySpecs` still
needs to be named in `options.extraFields` (an array of field names) to
reach the caller at all**, or it reads `undefined` even on an entry
that has it. This bit Metroguessr's own `hintsUsed` field for a full
PR: it was submitted correctly and rendered via `entry.hintsUsed` in
that page's own `renderLeaderboard()`, but nothing ever asked
`getTopLeaderboardScores()` to actually copy it over, so every real,
Firestore-backed entry's 🪄 badge silently stayed empty in production
the whole time - caught only once `streak` needed the exact same
plumbing and a test (`tests/shared/leaderboard-query.test.js`) was
added to lock the fix in.
- Metrordle: fewest attempts, a loss always after every win, hard-mode
  beats normal-mode at a tie
  (`[['attempts','asc'],['lost','asc'],['hardMode','desc']]`). See
  "Losses" below for the `lost` field and why it's second, not first,
  in that list.
- Laberinto: fewest stations, then fewest transfers, both ascending.
  Unlike Metrordle/Metroguessr, a give-up here still has nothing
  meaningful to rank (no route at all, not just a worse one) - it
  still only ever submits on a win.
- Memoria: highest score, descending.
- Metroguessr: fewest attempts, a loss always after every win,
  hard-mode beats normal-mode at a tie - same shape as Metrordle's own
  combined ranking
  (`[['attempts','asc'],['lost','asc'],['hardMode','desc']]`).
- Metro Crush: highest score, descending - same shape as Memoria's, but
  a cumulative round total rather than a fixed-size puzzle's score, so
  its Firestore rule bounds `score` generously (20000) instead of
  tightly (see `firestore.rules`).
- Clasificador: highest score, descending - same shape as Memoria's and
  Metro Crush's, including a display-only `hardMode` field (not part
  of `orderBySpecs`, same as Metro Crush's own). `score` is the
  round's own `total` (stations correctly classified) - open-ended
  like Metro Crush's own, so its Firestore rule bounds it generously
  (500) rather than tightly.

### High score records

Memoria, Metro Crush, and Clasificador - the three games ranked by a
raw score rather than a fixed day's puzzle outcome - also track an
all-time high score, separate from (and never cleared by) the daily
leaderboards above: a single long-lived `records/{gameKey}` Firestore
document (`MetroShared.updateHighScoreRecord()`/`getHighScoreRecord()`/
`formatHighScoreRecord()` in `shared.js`, `{score, alias, dateKey,
gameNumber, submittedAt}`), only ever overwritten by a genuinely higher
score - `firestore.rules`' own `request.resource.data.score >
resource.data.score` on `update` makes that a server-enforced
guarantee, not just well-behaved client code's own restraint. Each
game's `submitScore()` calls `updateHighScoreRecord(gameKey,
state.score, alias, state.dateKey, state.gameNumber)` as a best-effort
side effect of a successful leaderboard submission (never rejects, so
it can't turn an otherwise-successful submission into a visible
error). `getHighScoreRecord(gameKey)` + `formatHighScoreRecord()`
(`'🏆 Récord: N por alias · #N · date'`) render it in two places: each
game's own reveal-screen leaderboard (`.leaderboard__record`, shared
markup/CSS - see `shared.css`) and `/admin/`'s matching board, both
loading it once (no date dimension to re-fetch on date-nav) rather than
per-render like the per-day leaderboard lists above. Clasificador's own
`records/clasificador` was seeded from its real leaderboard's own
highest entry to date, rather than starting empty.

### Losses

Metrordle and Metroguessr both submit a loss to the leaderboard now,
not just a win - relies on `attempts` for a loss always being exactly
`TOTAL_ATTEMPTS` (5 for both games: Metrordle's own guess limit,
Metroguessr's `guesses.length + hintsUsed` when the round ends without
a correct guess), which is already >= any win's own attempts count.
That alone puts every loss last in `attempts asc` order EXCEPT the one
case where a win also happens on the very last possible attempt - tied
with a loss at that same value. `lost` (bool, `true` for a loss) is
the tiebreak for exactly that collision, which is why it's
`orderBySpecs[1]`, not `[0]`: `orderBySpecs[0]` is the one field
Firestore's own `.orderBy()` uses server-side (see above), and any
document missing that field is silently excluded from the query
entirely - `attempts` has been on every entry since each collection's
creation, so keeping it first means introducing `lost` can't
accidentally drop older entries from the results the way changing
`orderBySpecs[0]` itself would. A missing `lost` field (any entry from
before this shipped) is treated as `false` by `compareByOrderSpecs()`
- exactly correct, since every entry that predates this only ever got
submitted on a win in the first place (see "Submission pattern"
below). `renderLeaderboard()`'s own row-building renders a bare `-`
for `entry.lost`'s score number instead of the (constant, so
meaningless to actually show) attempts count - `/admin/`'s matching
`GAMES` entries do the same in their own `scoreCell()`. A loss also
resets that game's streak to 0 (see "Streaks" below) and now submits
`streak: 0` rather than skipping submission altogether, which is why
both collections' `firestore.rules` bound relaxed from `streak >= 1`
to `>= 0`, matching Memoria's own bound.

Submission pattern (identical across all 6 games): a
`leaderboardSubmitted` flag persisted alongside the game result, so a
reload never resubmits; `submitScore()` no-ops without an alias or
under `?debug=true`. Laberinto is the only one of the three
attempts/route-based games left where a loss (give-up, there) still
has nothing meaningful to submit - `renderAliasRow()` there still
hides the whole `#leaderboard-alias-row` on one, rather than a
no-alias player seeing an entry form that would silently do nothing if
filled in. Metrordle/Metroguessr's own `renderAliasRow()` always shows
now, win or loss, since both have a meaningful leaderboard entry to
submit - same as Memoria/Metro Crush/Clasificador's own alias row,
which always showed regardless of outcome already. `renderLeaderboard()` never
clears the DOM before its fetch resolves (avoids a flicker on reload),
guarded by a monotonically increasing request-id so a stale response
can't paint over a newer one.

### Streaks

Metrordle, Laberinto, Memoria, Metroguessr, Metro Crush, and
Clasificador all track a consecutive-days streak
(`MetroShared.loadStreak`/`saveStreak`/`updateStreakForResult`/
`formatStreak`/`formatMaxStreak` in `shared.js`, one `'<key>:streak'`
localStorage entry per game, separate from that day's own
`'<key>:' + dateKey` round-result entry), shown on that game's own
reveal banner/share text (`🔥 Racha: N días`, plus a "máxima: M días"
mention only when the best-ever streak is still ahead of today's - not
yet true of Clasificador's own reveal screen, which doesn't show the
streak anywhere in its own banner/text yet, only via its leaderboard
rows' badge). The first four extend it on a win and reset it to 0 on a
loss/give-up; Metro Crush and Clasificador both have no daily win/loss
puzzle outcome to hook that into (their games are scored per-round, not
"won" day to day), so each extends its own streak on any round that
ends with a non-zero score instead, and resets it only on a genuine
0-point round (still a real result - it submits and resets the streak,
rather than being skipped) - see `metrocrush/index.html`'s own
`STREAK_STORAGE_KEY` comment (Clasificador's own mirrors it).

Each of those six games' own `submitScore()` also submits `streak` as
a leaderboard field now, purely for display - like `hintsUsed` above,
it's deliberately never part of `orderBySpecs`, so a query's
ranking/results are identical whether or not a given entry (old or
new) happens to have it. `MetroShared.buildStreakBadge(streak)` in
`shared.js` is the one shared renderer for it - a `<span
class="leaderboard__streak">` (styled in `shared.css`, shared since
this is no longer a single page's own thing) reading **`🔥 × N` when
`N > 1`, nothing otherwise** (a streak of 0 or 1 isn't yet "a streak"
worth calling out), always returned (even empty) so a row's score
column still lands in the same spot whether or not it has one.
`/admin/`'s own `renderGame()` appends one to every row for all six
collections now; Metrordle's, Laberinto's, Memoria's, and
Clasificador's own `renderLeaderboard()` do the same on their own
in-page leaderboards (Metroguessr's and Metro Crush's own leaderboards
don't, yet - nothing architectural stops either, this just hasn't been
asked for). Every one of those `getTopLeaderboardScores()` calls needs
`extraFields: ['streak']` for the value to actually reach
`entry.streak` at all (see `extraFields` above) - `buildStreakBadge()`
itself doesn't guard against a missing field beyond `streak > 1`
already being false for `undefined`, so a call that forgets
`extraFields` just silently renders an always-empty badge, the same
failure mode `hintsUsed` hit before. Metro Crush's and Clasificador's
own leaderboard rules both bound `streak` the same generous `>= 0`/
`<= 5000` as Memoria's (see `firestore.rules`) - **this bound is a
manual deploy, not something CI applies** (see "Firebase credential
safety"/`firestore.rules`'s own bullet above); a PR that changes this
file still needs someone to actually paste it into the Firebase console
(or run `firebase deploy --only firestore:rules`) after merging, or
every real submission to a collection whose rule just changed will
fail closed against the *old* rule until that happens.

## Game suggestions

Every game's end screen (the `#reveal` state, once a round is over)
shows a "Sigue jugando hoy" `.game-promo` component suggesting other
games. Unlike leaderboard rendering, this one isn't split
data-in-`shared.js`/DOM-in-the-page: `MetroShared.buildGamePromo(currentGameKey,
dateKey)` builds and returns the whole detached `.game-promo` element
(or `null` if there's nothing to suggest) - it only knows the
component's own markup, never the page's, so it never reaches into a
page's DOM itself. Each page's own `renderGamePromo(key)` (duplicated
per page, since mounting into that page's layout is still page-owned
work) just finds its own `#game-promo-slot` placeholder and inserts
(or clears) whatever `buildGamePromo()` returns.

Suggestions follow a fixed priority order - Metrordle, Memoria,
Metroguessr, Laberinto, Metro Crush, Clasificador (see `SUGGESTABLE_GAMES`
in `shared.js`) - minus the current game and minus anything already
completed **today**, capped to the top `MAX_SUGGESTED_GAMES` (2) so the
section stays a quick glance rather than a full game menu (this list-building
part is also exposed standalone as `MetroShared.getSuggestedGames(currentGameKey,
dateKey)`, which `buildGamePromo()` calls internally). "Completed" is
checked via that game's own `'<key>:' + dateKey` localStorage entry
(every game's key matches its `storageKeyFor()` prefix, which is what
makes one shared check possible instead of one per game):
`gameOver`/`status !== 'playing'`/`done` for
Metrordle/Laberinto/Metroguessr, whose saved state can also represent
an in-progress round; any saved entry at all for Memoria/Metro
Crush/Clasificador, which only ever persist a result once a round is
actually over. Always
uses the real calendar day (`new Date()`), never the page's own
possibly-`?debug=true`-simulated `dateKey` - suggestions reflect actual
play activity, not whatever day is being previewed. `buildGamePromo()`
returns `null` (nothing to mount) rather than an empty component if
every other game is already done today.

## Site config

`/configurar/` is a site-wide settings page (not a game), reachable
from a small ⚙️ in every other page's header - `.brand__settings` for
every `.brand`-based page, `.topbar__settings` for Metroguessr's own
full-viewport `.topbar` layout instead, since it has no `.brand` row to
attach one to. `/admin/` and `/purge/` are the only exceptions worth
noting: `/admin/` still gets the link (harmless, even though it's
itself unlinked from any game's nav); `/purge/` doesn't, since it's
deliberately self-contained with no `shared.css`/`shared.js` at all
(see its own bullet above).

All settings live in one `'metrordle:config'` localStorage key holding
a plain object - `MetroShared.loadConfig()`/`saveConfig(partialConfig)`
in `shared.js`, same site-wide-single-key pattern as the alias. Started
with just one field, `mode` (`'light'`/`'dark'`/`'system'`, default
`'system'`); `reducedMotion` (boolean, default `false`, see below) is
the first to actually exercise the "meant to grow more settings later"
design - `saveConfig()` always merges its argument into whatever's
already stored, so setting one key never clobbers another one added
since.

The appearance picker's three-way toggle is `MetroShared.getThemeMode()`
(reads the stored `mode`, defaulting to `'system'` for anything
missing/invalid) and `MetroShared.setThemeMode(mode)` (persists +
applies immediately, no reload - what `/configurar/`'s own buttons
call on each click). Applying a mode just means toggling an attribute:
`MetroShared.applyThemeMode(mode)` sets `data-theme="light"`/`"dark"`
on `<html>`, or removes the attribute entirely for `'system'`.
`shared.css`'s `[data-theme]` rules already existed before this page
did (previously unused, prepared for exactly this) -
`:root[data-theme="dark"]` forces the dark palette regardless of the
OS preference, `:root:not([data-theme="light"])` is what lets
`prefers-color-scheme: dark` keep applying unless light was explicitly
forced instead; `color-scheme` (native scrollbar/form-control chrome)
mirrors the same three states, added alongside this feature since it's
the first thing that actually exercises the override.

Any page-specific logic that branches on light/dark **must** check
`MetroShared.getThemeMode()` (falling back to
`window.matchMedia('(prefers-color-scheme: dark)').matches` only for
`'system'`), never query `prefers-color-scheme` directly - Metroguessr's
own map tile style (`prefersDark()`, picks between
`MAPLIBRE_STYLES.light`/`.dark`) shipped doing exactly that and, for a
few hours after `/configurar/` itself shipped, could show light chrome
with dark tiles (or vice versa) for anyone with an explicit override
set. `tests/metroguessr/theme.test.js` locks the fix in.

**Every page but `/purge/` needs its own inline `<script>` in `<head>`,
right after its `<link rel="stylesheet" href="/shared.css">`**, that
reads `'metrordle:config'` directly and sets `data-theme` before first
paint - `shared.js` (loaded at the end of `<body>` on every page) runs
far too late to prevent a flash of the wrong theme on a page load, so
this snippet is deliberately self-contained (duplicating the bare
minimum of `loadConfig()`/`applyThemeMode()`'s own logic) rather than
depending on `shared.js` having loaded yet. `shared.js` itself still
calls `applyThemeMode(getThemeMode())` once at load time too - not the
flash-prevention mechanism, just a harmless, idempotent safety net for
a page whose snippet is missing or goes stale. Adding a new game or
utility page later means copying this same snippet into its `<head>`,
same as every other per-page duplication already documented in this
file.

`reducedMotion` is `/configurar/`'s own "Normal"/"Animaciones
limitadas" picker (a two-button group, same shape as the theme picker
minus its third "system" option - there's no "force MORE motion than
the OS wants" use case, so this one is purely additive; a single on/off
toggle button was tried first but read oddly on mobile, not obviously a
two-state control) for a player with motion sickness whose OS/browser
has no `prefers-reduced-motion` setting of its own, or who can't easily
reach it on their device. `MetroShared.getReducedMotion()`/
`setReducedMotion(enabled)`/`applyReducedMotion(enabled)` mirror the
theme mode's own three-function split, but unlike the theme there's no
pre-paint flash to prevent (a frame of default motion behavior isn't
jarring the way a wrong light/dark theme is), so no per-page `<head>`
snippet is needed - `shared.js`'s own `applyReducedMotion(getReducedMotion())`
call at load time is this setting's only real application point, not a
backup for one. **`MetroShared.prefersReducedMotion()` is the one
function every game's own animation timing already calls** (each
page's own `delay()` helper, computed once at load from this; or a live
check, like Metro Crush's `collapseBoard()`) - it now ORs the OS media
query with this setting, so turning the setting on reduces motion
everywhere those call sites already check, with no further per-game
wiring needed. `applyReducedMotion()` itself just toggles
`data-reduced-motion="true"` on `<html>` (or removes it) for the one
thing a JS-level check can't catch: a raw CSS `transition`/`@keyframes`
animation with no JS gate of its own - `shared.css` has a
`:root[data-reduced-motion="true"] *` rule that's an exact twin of its
own `@media (prefers-reduced-motion: reduce)` block, rather than a
combined selector, so the two stay simple and independently readable.

`/configurar/`'s third section, Alias, is the one place to change
`metrordle:alias` directly (every other place it's ever set is a
per-game leaderboard's own first-time alias-input row, see
"Leaderboards" above) - a `.leaderboard__alias` input+button row
(shared.css, the exact markup every game's own leaderboard alias row
already uses) pre-filled from `MetroShared.getAlias()`, saved via the
same `MetroShared.setAlias()` every other call site uses. A blank/
whitespace-only submission is rejected with an error notice rather
than silently clearing the alias (every other call site's own
`save()` just `return`s on an empty `setAlias()` result, with no
feedback either way - fine for a quick inline leaderboard row, not for
a dedicated settings field someone could accidentally submit blank).
The success/error notice (`#alias-notice`, `aria-live="polite"` same
as Metro Crush's own `.toast`) auto-hides after 4s. Detecting a
genuine save failure (private mode, full storage) needs an extra step
since `setAlias()` itself always returns the normalized value
regardless of whether the write actually landed - the only way to
tell is reading `getAlias()` back immediately after and comparing.
See the Leaderboards section's own intro above for what changing the
alias here does and doesn't do to already-submitted entries.

## Rendering safety

**Every leaderboard `alias` render uses `.textContent`, never
`.innerHTML`** - aliases are arbitrary user text (Firestore only
validates type/length, not content) and are the only content that
flows from one player into another's browser. This convention is not
enforced by tooling (no lint/build step) - grep for `entry.alias` and
confirm every hit is a `.textContent` assignment before adding any new
leaderboard consumer. A CSP `<meta>` tag on every page adds
defense-in-depth on top of this (see each page's own CSP comment for
the exact policy and its documented `'unsafe-inline'` tradeoff).

## Debug mode

`?debug=true` on any game page reveals a prev/next date-nav
(`MetroShared.getEffectiveToday`/`getDateKey`) to preview any day's
puzzle without waiting for it, and makes `submitScore()` a no-op site-wide
so date-nav testing never pollutes the real leaderboards. `?date=YYYY-MM-DD`
also works standalone (validated by regex, falls back to real "today" if
malformed).

## Tests

Playwright, no framework beyond `assert` - see `tests/README.md` for
the full breakdown of what each file covers and how to add a check.
`cd tests && npm test` runs everything (~95s).

**Before running tests locally, swap `firebase-config.js`'s real
credentials for fake placeholder ones, then restore and verify
`git diff origin/main -- firebase-config.js` is empty before
committing/pushing - never skip this.** The repo's real project is
live; this sandbox can't reach `gstatic.com`/Firestore at all, which is
itself exercised as the "Firebase unreachable degrades gracefully" case
in every leaderboard test.

**A `page.route('**/shared.js', ...)` patch (the trick every "real
data" leaderboard/admin test uses to fake `getTopLeaderboardScores()`/
`submitLeaderboardScore()`) stops working across a `page.reload()`
unless the context is created with `serviceWorkers: 'block'`.** Every
real page here registers `sw.js`, which precaches `/shared.js` - once
it's installed (may happen mid-test, not just on a later visit), a
reload can be served straight from the service worker's own Cache
Storage instead of hitting the network a second time, which
`page.route()` does not see at all. Symptom: the route handler fires
once (the initial load) and never again, so the reload silently runs
the REAL `shared.js`/Firestore path instead of the patched one -
looks like the patch "didn't take" rather than a caching issue.
Belt-and-suspenders: also set `cache-control: no-store` on the
`route.fulfill()` response, in case regular HTTP caching (unrelated to
the service worker) has the same effect. Only matters for a test that
reloads or re-navigates the same page after registering the route -
a single `goto()` per test (most of this suite) never hits this.

## Git workflow

Branch off latest `main` for every change, one PR per logical change,
never push directly to `main`. Commit messages and PR bodies end with
the attribution footer from the session's system prompt. Known open
PRs as of this writing: **#33** (service-worker cache-consistency,
already bumped `CACHE_NAME` on its own branch - expect a collision) and
**#13** (Laberinto neighbor-fan layout, unrelated/stale). Re-check
current PR state via the GitHub MCP tools before assuming either is
still open - this list goes stale.
