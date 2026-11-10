# Navigation loader

**Status: #1 and #2 are implemented** (see `shared.css`'s `@view-transition`
+ `.nav-loader` and `shared.js`'s `initNavLoader`); #3-#5 remain proposed.
This note keeps the full set of alternatives on record.

## Context

Metrordle is a multi-page static site (GitHub Pages, no build step): every
nav link - the footer's *Todos los juegos* / *Tablero*, the brand favicon
home link, each game card on `/juegos/`, the reveal's "sigue jugando hoy"
promo - triggers a **full document load**, not a client-side route change.

`sw.js` (network race with a 1.5s timeout, cache fallback, see
`docs/service-worker.md`) already makes *cached* pages feel near-instant,
so the visible gap is really: a first visit, an uncached page, a slow
network, or a cold service worker. A nav loader gives feedback during that
gap instead of a blank flash.

Any solution should fit the repo's grain: no build step, pages served
as-is, shared behavior injected once by `shared.js` (the `initToolbar` /
`initFooter` pattern) rather than copied per page, es-MX copy, and a
sensible baseline with JS disabled.

## Alternatives (roughly increasing effort)

1. **Cross-document View Transitions (CSS only).** Add
   `@view-transition { navigation: auto; }` to `shared.css` and the browser
   cross-fades between same-origin pages on navigation with zero JS. Pure
   progressive enhancement (unsupported browsers just do the normal instant
   swap). Elegant at hiding the flash, but it's a transition, not an
   explicit "still loading" spinner, and it only engages once the next
   document starts rendering - it doesn't cover a long network wait.

2. **Top progress bar / overlay on click + `pagehide` (`shared.js`).** The
   pragmatic main option. On a nav-link click (and/or the `pagehide` /
   `beforeunload` event) show a thin top progress bar (NProgress-style) or a
   light overlay *immediately* on the outgoing page; the new document paints
   over it. One place (`shared.js`), no dependencies, no per-page HTML, and
   it covers the real "I tapped and nothing happened yet" gap. Caveat:
   back/forward (bfcache) and instant SW hits can flash the bar - gate it
   behind a short delay (~150ms) so fast navigations never show it.

3. **Prefetch on intent (hover / `touchstart`).** `<link rel="prefetch">`
   or a `fetch()` of the destination when the user hovers/taps a nav link,
   so the target is warm by click time. *Reduces* the delay rather than
   masking it; pairs well with #2. Cheap, but prefetch costs bandwidth -
   scope it to the handful of nav links, not every game card.

4. **Lean on the service worker (already present).** Cached routes are
   already near-instant, and `PRECACHE_URLS` covers every page, so after the
   first visit most navigation needs no loader at all. Lowest effort:
   decide the loader is only worth it for the cold path and keep #2 minimal
   (or skip it) rather than building anything for the already-fast case.

5. **Client-side navigation / pseudo-SPA.** Intercept nav-link clicks,
   `fetch()` the target HTML, swap the content region, and drive a real
   spinner plus the View Transitions *API* for the animation. Smoothest and
   gives full control of the loader, but it turns the MPA into an SPA:
   fights "each page is self-contained," complicates every page's inline
   `<script>`, and is the most to build and maintain with no build step.
   Almost certainly not worth it here.

## Recommendation

Combine the cheap wins and stay in `shared.js` / `shared.css` so it lands
on every page at once with no per-page edits:

- **#1** - the free cross-document fade, if the browser-support floor is
  acceptable (it degrades silently where it isn't).
- **#2** - a `shared.js`-injected top bar shown on nav-link click /
  `pagehide`, delayed ~150ms so fast/cached navigations don't flash it.
- optionally **#3** for just the footer's two nav links.

Let the service worker keep owning the cached-fast path (#4). Skip the
pseudo-SPA (#5) unless the site ever adopts a real SPA/build.
