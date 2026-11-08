# Utility & internal pages

- **`/juegos/`** - a plain index page listing every game, built from the
  same `.game-promo` card design the end-screen "sigue jugando hoy" promo
  uses. `MetroShared.buildAllGamesGrid(dateKey)` (shared.js) renders all of
  `SUGGESTABLE_GAMES` as cards, sorted A-Z by name, with the games already
  played **today** (`isGamePlayedToday`, real calendar day) moved to the
  end and muted via `.game-promo__card--played` (shared.css: `opacity: 0.5`,
  restored on hover - still enabled links). Shares the card markup with
  `buildGamePromo` through a common `buildGameCard(game, muted)` helper.
  Player-facing, so precached (`sw.js`'s `PRECACHE_URLS`, so a change needs
  a `CACHE_NAME` bump); loads no Firebase. Lists all of
  `SUGGESTABLE_GAMES` (seven now that Copo de nieve joined) - not the
  `/sopa-de-metros/` prototype, the one game still outside that list.
  Linked from each game page's footer: a `<p class="credit">` holding
  `<a href="/juegos/">Todos los juegos</a> · <a href="/tablero/">Tablero</a>`
  (an interpunct `·` between the two) on `/`, `/laberinto/`, `/memoria/`,
  `/clasificador/`, `/metrocrush/`, `/copo-de-nieve/`, and `/configurar/` -
  plain `color: inherit` links
  (shared.css's global `a` rule). `/configurar/` used to read "← Volver a
  Metrordle" (→ `/`); it now matches the games, for header/footer parity.
  The `Tablero` link was added alongside the existing "Todos los juegos"
  one (every footer page but `/tablero/` itself gets it). On the first five it
  replaced the old "Basado en el trazado real..." credit line; Copo had
  no footer before, so it just gained one. Metroguessr has no such
  footer (full-bleed map layout), so it stays unlinked for now.

- **`/tablero/`** - read-only cross-game leaderboard browser (was
  `/admin/`; renamed). Now a player-facing page: linked from every footer
  page's `.credit` (the `Tablero` link - see the juegos bullet above) and
  indexable (the old `noindex` was dropped). Precached (`sw.js`'s own
  `PRECACHE_URLS`), so a change to its `index.html` needs a `CACHE_NAME`
  bump - see the `sw.js` bullet.
  Same prev/next date-nav as the
  games' own `?debug=true` mode, gated behind that same param (each
  game's own "Ver este día en ___" deep link too) - shows only today's
  real data otherwise. Two `.stat-grid`/`.stat-box` tiles (shared with
  Metro Crush's own reveal screen - see `shared.css`) above the
  per-game boards: unique aliases across every game that day, and
  total leaderboard entries across every game that day (every
  submitted result, not deduped by alias).

- **`/design/`** - a visual-language reference (not linked from any
  game's nav, `noindex`, same as `/tablero/`): side-by-side examples of
  how a Metro line or a station is shown today - most of them still
  competing, un-redrawn copies of each game's own `<style>` block
  (pulled as-is, not hand-approximated), pending a decision; four
  concepts have actually been decided and consolidated already (see
  below). The page opens with a quick index (anchor links to each
  board below); each board's own `<h2>` title is a self-link
  to its section's anchor (`#board-<slug>`, e.g. `#board-lineas`), for
  quickly reloading/returning to a section. This chrome is
  page-local (the `.design-index` styles live in this page's own
  `<style>`, not `shared.css`). (A standalone sun/moon theme toggle
  lived here until it was removed; change the theme via `/configurar/`
  or the shared toolbar's own light/dark toggle, which sits next to the
  gear on every page - see "Site config" below.) A "Líneas" board (the already-decided
  `.line-bar__badge` (+ its `--sm` size, shown as its own example),
  Metroguessr's `.hint-line-badge`, plus the already-decided
  `.line-badge` and `.route-dot` - see "Shared infrastructure" below),
  an "Estaciones" board (the already-decided `.station-circle` family -
  Laberinto's transfer-map circles, `--sm` for a line-colored neighbor
  and `--muted` for the soft-inverted current-station hub, promoted from
  Laberinto's own page-local copy; plain text; the
  already-decided `.station-card` (Memoria's own board card); the
  already-decided `.station` (Metro Crush's `.tile`/Metroguessr's
  `.target-icon-marker` - see "Shared infrastructure" below) plus its
  own `.station--chip` size (Metro Crush's `.legend__chip`) and its
  `.station__icon--mask` variant (Copo de nieve's mask-rendered board
  silhouette, the one example here built from an inlined sprite mask via
  `MetroShared.buildStationMasks` rather than a `<use>`, with its last two
  cells recolored to show the `--ok`/`--danger` hit/wrong states), and
  the already-decided `.station-grid-6` reveal grid (now shared - see
  "Shared infrastructure" below) - 18 stations across 3 rows of 6,
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
  `.notice` now, same as the other five. The end screen itself was later
  reworked: instead of the reveal sitting as a bottom sheet over the live
  map, the round-over state (`body.round-over`, set in `showReveal()`,
  cleared for a fresh round in `finishStartingGame()`) **hides the map**
  and lets the reveal flow as a normal page (the sheet's own
  `position:fixed`/`max-height`/inner-scroll are dropped; `html,body`'s
  own `overflow:hidden` is relaxed so the page scrolls as a whole). The
  correct station is shown as its own icon-and-name display
  (`#reveal-station` - a `.station` badge colored by its line, built by
  the shared `paintStationBadge()` the map's own target marker also uses,
  plus the name) in place of the map, on **both** win and loss - so the
  banner no longer names the station on a loss, it's just the streak line
  now. An "Explorar el mapa" button (`#view-map-btn`) opens the map
  fullscreen again (reusing the existing `.map-maximized` state - map
  shown, reveal hidden), and the floating `.map-maximize-btn` becomes the
  ✕ that closes back to this view (it's hidden on the end screen until
  then, since the in-flow button is how you open the map there; it stays
  the ⛶/✕ toggle while actually playing). `setMapMaximized()` calls
  `map.invalidateSize()` when opening, since the map was `display:none`.
  `tests/lib/metroguessr-helpers.js`'s own `revealedTarget()` reads the
  target off the map's own station-icon badge (`window.__mgIconMarkerEl`,
  set by the Leaflet test stub), reverse-looking-up
  `MetroShared.STATION_ICON_SLUGS` from the badge's `<use>` href - a
  source of truth independent of win/loss, and of the banner's own
  wording. (Metrordle's own
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
  `.mode-modal`/`.mode-option` (a full-screen pre-game normal/hard choice -
  Metrordle and Metroguessr both used it once, but each moved to its own
  inline `.start-overlay` instead, so no game renders `.mode-modal` anymore;
  it stays shared/cataloged here as `.mode-modal__card`
  inline - `.mode-modal` itself is `position: fixed`, which would break
  out of the gallery's own layout the way every other example on this
  page stays inline, and `.mode-option` is still live for `/configurar/`'s
  own theme picker) are all real, already-shared classes - as is
  `.start-overlay__modes` (Metro Crush's, Clasificador's, Metrordle's, and
  now Metroguessr's
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
  `?debug=true` date-nav chevrons every game and `/tablero/` use - a
  square icon variant of `.btn-secondary`, see "Shared infrastructure"
  below) and `.debug-mode-toggle` (the small normal/hard toggle on that
  same debug row). `.btn-secondary--chev` gets a second example too, for
  Metrordle's own per-row station-reorder controls, which reuse it: a
  ▲▼ pair (full-size `.btn-secondary--chev`, in `.platform__buttons`) to
  move a station up/down in normal mode, and a ◀▶ pair
  (`.btn-secondary--chev-sm`, in `.platform-icon-col__nav`) to move it
  left/right in hard mode - the button is the shared class, only the
  flex wrappers are page-local.
  A "Marcadores" board catalogs the shared `.leaderboard*` component (all
  ✅ consolidado - the whole thing lives in shared.css now, see "Shared
  infrastructure"): the list shell (`.leaderboard`/`__list`/`__row`, the
  `--you` self-highlight, `__rank`, `__alias-name` rendered via
  `.textContent`, and the `🔥 × N` `.leaderboard__streak`) with a
  `.leaderboard__score--plain` number, then the two badge+number score
  cells (`.leaderboard__score` + `.leaderboard__score-badge` + a
  `.leaderboard__score-number--narrow`/`--wide` number), then the
  `.leaderboard__record` (a golden row-shaped card shown on top of the
  list) and the `.leaderboard__status` line - built from real shared
  classes with hardcoded sample aliases, not `.design-` stand-ins.
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
  real palette. Deliberately left out of `sw.js`'s own `PRECACHE_URLS`
  (not a player-facing game route - same reasoning that used to apply to
  `/tablero/`, which is precached now, so `/map/` is its closest still-
  excluded peer).

- **`/configurar/`** - site-wide settings page, linked from every game's
  header (a small ⚙️ in `.brand`, or `.topbar` for Metroguessr's own
  layout) via `.brand__settings`/`.topbar__settings`. For now just a
  Claro/Oscuro/Sistema appearance picker - see "Site config" below for
  the storage/theming mechanism, meant to grow more settings later
  without a new page or a new localStorage key.

- **`/status/`** - a read-only ops health check (not linked from any
  game's nav, `noindex`, same as `/tablero/`/`/design/`), but unlike
  `/design/` (and `/map/`), deliberately precached (`sw.js`'s own `PRECACHE_URLS`) so
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
  nav and `noindex` - same as `/tablero/`/`/design/` - and not precached,
  same as `/design/` (`/tablero/` is precached now); English
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
