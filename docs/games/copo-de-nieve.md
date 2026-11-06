# Copo de nieve (`/copo-de-nieve/`)

- **`/copo-de-nieve/`** - a reflex/arcade game, graduated partway out of
  prototype: it has its own daily Firestore leaderboard, streak, all-time
  high-score record, and game number now (see those sections below), and
  is precached (`sw.js`'s own `PRECACHE_URLS`, both the directory and its
  `index.html` - so a change needs a `CACHE_NAME` bump). Still **not**
  linked from any nav and still `noindex`, but now in `SUGGESTABLE_GAMES`
  (appended last, after Clasificador) - so every game's "sigue jugando
  hoy" promo can suggest it and `/juegos/` lists it, same as the other
  six; its own share text still doesn't carry the suggestions promo yet.
  A 7×7 grid of station
  cards all show one station pictogram except one, randomly placed, with
  a different one - the "única y especial" station (the game's snowflake
  theme); tapping it deals a fresh pair (`nextRound()`) and scores a
  point. The goal is to find as many as possible in 60 s. In normal mode
  a wrong tap just flashes the card (`cell--wrong`) - no time penalty
  (there was a flat 1.5 s one once; dropped). Has a normal/hard mode
  toggle now, chosen Metro-Crush/Clasificador-style via two buttons in
  the start overlay (`start(mode)`) with the hard-mode explanation below
  them. Hard mode makes the 60 s clock elastic, the same mechanic as
  Clasificador's own `HARD_BONUS_RUN` (5): every 5 correct taps in a row
  add a second to the clock (adjusting `state.endTime`, since the timer
  is `performance.now()`-based, not a per-second `timeLeft`), each wrong
  tap subtracts one (ending the round if it hits 0), with the shared
  `MetroShared.pulseClock()` +1/−1 cue (promoted from Clasificador's own
  page-local copy once this became its second consumer - the `.clock*`
  CSS and the JS helper both live in shared now).
  The `timeFill` width is clamped to 100% since a bonus-fed `endTime` can
  run past `ROUND_MS`. `state.secondsWon`/`secondsLost` are shown as a
  two-tile `.stat-grid` on the hard-mode reveal (same as Clasificador),
  and `hardMode` is submitted as a display-only leaderboard field (🧠
  badge) + a `🧠 Modo difícil` share-text line. `state.mode`/
  `secondsWon`/`secondsLost` persist in both the in-progress
  (`persistProgress`) and finished (`persistResult`) saves, so a resumed
  hard round keeps its elastic clock and the reveal keeps its stats. The
  board is icon-only in both modes (already its design), so hard mode
  adds no name-hiding the way Clasificador's does. The deal sequence is
  **deterministic per day** like every other game: all per-round
  randomness (which two icons,
  where the odd one lands, the difficulty-ramp choices) routes through one
  seeded stream, `MetroShared.createSeededRandom('metrordle-copo-de-nieve-'
  + dateKey)`, reseeded at each `start()` - so every player gets the same
  ordered sequence of deals (and thus the same difficulty curve), and a
  same-day replay reproduces it exactly. The day's state is persisted to
  `'copo-de-nieve:' + dateKey` in one of two shapes: an in-progress round
  (`persistProgress()`, autosaved once a second - `{status:'playing',
  score, found, remainingMs}`) or the finished result (`persistResult()` -
  `{score, found, leaderboardSubmitted}`). On reload `initDay()` **resumes**
  an unfinished round (`resumeGame()` reseeds and replays `nextRound()`
  score+1 times - the deal sequence being a pure function of day+score, with
  the score each deal was dealt at for the ramp - to restore the exact board
  and RNG position, then counts down from `remainingMs`), or shows the
  reveal for a finished one and never resubmits. The pre-game ready screen
  shows a full timer bar (set instantly, bypassing the 0.3s width ease), and
  the reveal shows `0:00` (set in `renderReveal()`, so a reloaded finished
  day shows it too, not the markup default `1:00`). The single play-again in
  normal play is "Seguir jugando sin guardar", a no-stakes practice mode copied
  from Metro Crush (`continuePractice()`/`endPractice()`): it snapshots the
  already-submitted result, deals a fresh non-deterministic sequence
  (`...-practice-<dateKey>-<Date.now()>`), hides the countdown track for a
  count-up clock and points-since-start, and never reaches
  `submitScore()`/`persistResult()`; "Volver al resultado" restores the exact
  snapshot. There's no deterministic "Jugar de nuevo" replay button anymore -
  the reveal never shows the start button (`finish()` still guards `state.replay`,
  now only reachable via `start(true)`, which nothing calls). The reveal also
  has a "Compartir" share button (`shareResult()`/`buildShareText()`/
  `MetroShared.shareOrCopyText()`, same as the other games) rating the round via
  a `getRating(score)` open-scale band (🟥-🟪, tuned to Copo's own faster pace -
  10-point bands up to 50). `?date=YYYY-MM-DD` previews another day's sequence for QA, and
  under `?debug=true` the shared `.date-debug` prev/next nav (via a `debugDate`
  offset passed to `getEffectiveToday()`, same pattern as the other games)
  steps through days. Icons are real station
  pictograms: the page fetches `/station-icons.svg` once and turns each
  symbol into a CSS mask data URI (the pictograms are single-color, so the
  masked silhouette is the exact icon the other games render via `<use>`);
  the pool is every distinct slug in `MetroShared.STATION_ICON_SLUGS`. This
  mask-based silhouette is now a shared station variant,
  **`.station__icon--mask`** (shared.css), fed by
  **`MetroShared.buildStationMasks(svgText)`** (shared.js, turns the fetched
  sprite into a `{slug: maskUrl}` map) - an alternative to the `<use>`-based
  `.station__icon` for repainting many icons cheaply by swapping one CSS
  custom property (`--station-mask`) instead of touching the DOM. Copo is
  its only consumer so far (its `.cell__icon` carries the shared classes and
  only sets `--station-mask` from the board's `--major`/`--odd` and the
  silhouette `color` for its hit/wrong states); the `.cell` tile otherwise
  reuses the station family's neutral-`--paper-well` look and `0 33% 0 0`
  corner. Shown in `/design/`'s Estaciones board (✅ consolidado) - the one
  example there that needs the sprite fetched + inlined via
  `buildStationMasks`, since every other station icon on that page is
  `<use>`-based.
  Written for minimal repaint: the 49 `.cell` nodes are built once and
  never rebuilt - a round only sets two CSS custom properties on
  `#board` (`--major`/`--odd`, the two icon masks every cell reads via
  `var()`) and moves the `.cell--odd` class, ~4 writes total; input is
  one delegated listener on `#board`. The end-of-round overlay (the same
  `.start-overlay` reused as a reveal) fills the card's full width in the
  result state (`.board-stage--done` drops the shared `.start-overlay__panel`
  18rem cap - right for the narrow pre-game start panel, wrong for a full
  reveal - zeroes the board-stage's own side padding, and sets the overlay's
  own 1.3rem to match `.sign__head`, so the reveal lines up under the title
  instead of sitting narrow and over-indented). It shows the icons of every
  station found that round - a grid of shared `.station` tiles with a staggered
  pop-in, same shared `.station-grid-6` as Memoria's: each tile is
  filled with its station's own line color (`--badge-bg`/`--badge-ink`,
  via a `lineForSlug()` that maps the found icon slug back to a station
  name then its line) and the grid is clustered by line, then alphabetical
  within each line (by `nameForSlug()`), like Memoria's. The old bespoke "Encontraste N estaciones especiales."
  summary line above it is gone - the colored grid and the `.notice`
  streak carry the result now. Below the grid the same overlay shows
  the day's `copo-de-nieve-leaderboard` (alias row + top-5 list + the
  all-time `records/copo-de-nieve` card), and the end-of-round `.notice`
  carries the streak (`🔥 Racha: N días`) - the whole leaderboard/streak/
  record/game-number wiring is the score-based pattern copied from
  Clasificador (`submitScore()`/`renderLeaderboard()`/`renderAliasRow()`/
  `renderHighScoreRecord()`), ranked by a single descending `score`.
  Loads Firebase (the two gstatic compat SDKs + `/firebase-config.js`)
  before `shared.js`, same as the real games; its CSP already allowed the
  Firestore/gstatic origins. Uses shared.css
  (`.sign`/`.progress`/`.start-overlay`/`.station`/`.notice`/`.leaderboard*`/
  `.btn-primary`) + shared.js. The visual-similarity table driving the ramp
  is precomputed offline by `copo-de-nieve/build-icon-similarity.js` and
  baked into `index.html` (see `build-icon-similarity.md`). No committed
  Playwright test yet (validated via a scratchpad run).
