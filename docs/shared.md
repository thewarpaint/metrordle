# Shared infrastructure: `shared.js` & `shared.css`

- **`shared.js`** - `window.MetroShared`: date-key/seeded-RNG helpers,
  streak tracking (localStorage, also submitted to each game's own
  leaderboard for `/admin/`'s 🔥 display - see "Streaks" below), alias
  helpers, the leaderboard API (`submitLeaderboardScore`/
  `getTopLeaderboardScores`, collection- and field-shape-agnostic - see
  "Leaderboards" below), clipboard/share
  helpers (`shareOrCopyText`, native `navigator.share` with a
  clipboard-copy fallback), `buildGamePromo(currentGameKey,
  dateKey)` for the "sigue jugando hoy" component on every game's own
  end screen and `buildAllGamesGrid(dateKey)` for the `/juegos/` index
  (both from a shared `buildGameCard` - see "Game suggestions" below),
  `renderNoticeBanner(el,
  variantClass, title, bodyText)` for every game's own end-of-round
  `.notice` banner (see `/design/`'s own "Avisos" bullet above),
  `pulseClock(timeEl, deltaEl, delta)` for the hard-mode elastic-clock
  +1/−1 cue (Clasificador, Copo de nieve, Metro Crush, paired with the
  shared `.clock*` CSS below), and
  the site-wide config object (`loadConfig`/`saveConfig`/`getThemeMode`/
  `applyThemeMode`/`setThemeMode` - see "Site config" below), and
  `buildStationMasks(svgText)`, which turns the fetched station-icon sprite
  into a `{slug: maskUrl}` map for the `.station__icon--mask` CSS variant
  (see shared.css). The shared
  data tables also live here: `LINES` (per-line station order + colors),
  `STATION_ICON_SLUGS` (station -> pictogram), and `STATION_COORDS`
  (`[name, lat, lng]` for Metroguessr's map and `/map/` - moved out of
  `metroguessr/index.html` so both read the exact same recorded data;
  Línea 12 isn't in the source dataset yet).
- **`shared.css`** - design tokens (`:root` custom properties, light +
  dark via `prefers-color-scheme` and `[data-theme]`), the embedded
  Overpass font (base64 `@font-face`, huge single line - don't `cat`
  the whole file), a site-wide `body { touch-action: manipulation }`
  (kills double-tap-to-zoom and the 300ms tap delay while keeping
  pinch-zoom - distracting in the quick-tap games; an ancestor
  `manipulation` restricts every descendant, so this one rule replaced
  the per-board copies Copo/Metro Crush/Sopa used to keep), and
  cross-game primitives (`.wrap`, `.brand`,
  `.sign`, `.date-debug` date-nav (its chevrons are
  `.btn-secondary--chev`, below), `.debug-mode-toggle`,
  `.mode-modal`/`.mode-option*` (a full-screen pre-game choice no game
  renders anymore - both its old users, Metrordle and Metroguessr, moved to
  the inline overlay below; `.mode-option` itself is still live for
  `/configurar/`'s theme picker)
  and the lighter inline `.start-overlay`/`__panel`/`__text`/`__modes`
  that covers a game's own board until play begins - a normal/hard choice
  via `__modes` (Metrordle, Metro Crush, Clasificador, Metroguessr - the
  last over its full-bleed map, with a page-local `--paper-well` background
  override) or just a single
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
  flex sizing stays per-context), the whole `.leaderboard*` component
  (`.leaderboard`/`__title`/`__alias`/`__list`/`__row` (its border matches
  the `--paper-well` fill, so an ordinary row shows none - it only reserves
  the 1px the current player's `__row--you` `--focus` border needs, keeping
  every row the same size)/`__row--you`/`__rank`/
  `__alias-name`/`__streak`/`__record`/`__status`, the `.leaderboard__score-badge`
  hard-mode 🧠/🪄 flag, and the score cell: `.leaderboard__score` is a flex
  badge+number row, `--plain` the bare-number alternative (Laberinto,
  Memoria), `.leaderboard__score-number` the number beside a badge with
  `--narrow` (single-digit attempts: Metrordle, Metroguessr) and `--wide`
  (multi-digit score: Metro Crush, Clasificador) width modifiers - every
  game's reveal leaderboard and `/admin/` build from these, cataloged in
  `/design/`'s own "Marcadores" board; the only page-local leaderboard CSS
  left is genuine deltas - Metroguessr's compact-sheet font sizing + widened
  3-emoji badge, Metro Crush's/Metroguessr's `text-align: left` (their
  `.reveal` centers), and `/admin/`'s tighter margins/wider rank),
  `.line-badge` - a line
  indicator, colored by line via `--badge-bg`/`--badge-ink` falling
  back to the site-wide `--line`/`--line-ink` tokens, used by
  Clasificador's own classification buttons and by Metrordle's own
  line-of-the-day indicator - the first pattern `/design/`'s own
  catalog actually settled on, see its own comment in `shared.css` and
  `/design/`'s own bullet above; `.line-bar__badge` - the same
  rounded-corner square but a single bold id with no "Línea" caption
  (Clasificador's result-row roundel), colored the same
  `--badge-bg`/`--badge-ink` way, promoted from Clasificador's own
  page-local copy (and `/design/`'s old `.design-badge` stand-in) once
  Sopa de metros became a second consumer - Sopa leads each clue with
  `.line-bar__badge--sm` (the one smaller size modifier) roundel(s)
  instead of "estación de la Línea N" text: one seeded line in "Pistas",
  all of a solved station's lines in "Respuestas" (see its own bullet
  above); `.station-card` - a neutral station
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
  for why)). `.station__icon--mask` is its one variant - the same icon box
  but painted as a CSS `mask` silhouette (filled with the span's own
  `color`, image from the `--station-mask` custom property) instead of an
  inner `<use>` svg, for a consumer that needs to repaint many icons by
  swapping one property rather than touching the DOM. `MetroShared.
  buildStationMasks(svgText)` (shared.js) builds the `{slug: maskUrl}` map
  it reads; `/copo-de-nieve/`'s 49-cell board is the only consumer so far.
  A fifth pattern joined these: `.route-dot` (Laberinto's
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
  page-local for positioning/interaction. An eighth pattern joined these:
  `.station-grid-6` (6-col grid) + `.station-grid__cell--entering` and the
  `station-grid-pop-in` keyframe (the end-of-round grid of `.station` tiles -
  Memoria's, Copo de nieve's, and Clasificador's own icon summary, three
  page-local copies of the same grid + staggered pop-in, each with its own
  per-page-named keyframe, now one shared class + keyframe; the `-6` encodes
  the column count). Only each page's own `gap`/`width`/`margin` stay
  page-local; cataloged in `/design/`'s own "Estaciones" board (✅ consolidado).
  `.progress`/`__label`/`__count`/
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
  design page shows them directly, so page-local was the wrong home. The
  hard-mode elastic-clock cue lives here too now - `.clock`/`.clock__time`
  (`.clock--up`/`--down`) + `.clock__delta`/`--show` + the
  `clock-delta-rise` keyframe, driven by `MetroShared.pulseClock()` and
  reusing an `.attempt-chip` for the floating +1/−1 - promoted from
  Clasificador's own page-local copy once Copo de nieve became its
  second consumer (the only difference had been the time element's id,
  now the shared `.clock__time` class), with Metro Crush its third.
  `.practice-banner`/`.practice-banner__text` (the "keep playing, nothing's
  saved" in-round banner shown past a timed game's reveal - Memoria's and
  Metro Crush's own `continuePractice()`) also live here now, promoted from
  Memoria's page-local copy once Metro Crush became its second consumer.
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
