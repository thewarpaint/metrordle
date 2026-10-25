# Icon similarity table (`/copo-de-nieve/`)

`build-icon-similarity.js` precomputes how visually similar each station
pictogram is to every other one, and bakes the result into `index.html`.
The game (`Copo de nieve`) uses it for its **difficulty ramp**: early
in a round the odd icon is a random, clearly-different one; as the score
climbs it's drawn from the majority icon's most visually-similar
neighbours, so telling them apart gets progressively harder.

## What it writes

It replaces the block between these markers in `index.html` (and nothing
else):

```js
// ICON_SIMILARITY:START (generated; do not edit by hand)
var SIM_SLUGS = [ ...pool slugs... ];
var SIM_NEIGH = [ [ ...indices into SIM_SLUGS, most-similar first... ], ... ];
// ICON_SIMILARITY:END
```

`SIM_NEIGH[i]` is the top-`TOP_K` most-similar neighbours of `SIM_SLUGS[i]`,
most-similar first, as indices into `SIM_SLUGS`. The game only needs the
hard (most-similar) end — the easy end is just "a random different icon",
so the full ranking isn't stored. Until this is populated the game still
runs; it simply stays all-random (easy), so it's safe to ship before a
rerun.

## How similarity is measured

Each pictogram (a single-color path in `/station-icons.svg`) is:

1. rasterized, then **cropped to its filled bounding box and rescaled into
   a fixed field** — so position and scale don't matter, only shape.
   Rotation and mirroring are deliberately left intact: at card size they
   are fair tells, not noise.
2. lightly **blurred**, so a near-miss scores gracefully instead of falling
   off a cliff when two thin shapes barely overlap.
3. compared pairwise with a **soft IoU** — `sum(min(a,b)) / sum(max(a,b))`
   over the blurred silhouettes, in `[0, 1]`.

Pairs more similar than `UNFAIR_CAP` are dropped: near-identical
pictograms are impossible to tell apart on a ~50px card, so they'd make
the hardest rounds unfair rather than hard.

## Running it

From the repo root:

```sh
node copo-de-nieve/build-icon-similarity.js
```

It prints the icon count and a few of the most-similar pairs (a quick
eyeball sanity check), then rewrites the marker block in `index.html`.
The pool is read from `STATION_ICON_SLUGS` in `shared.js` and the shapes
from `station-icons.svg`, both already in the repo — no arguments.

**Requirements:** [Playwright](https://playwright.dev/) (the repo's test
dependency — `cd tests && npm install` if it isn't installed) plus a
Chromium it can launch. In the cloud dev environment Chromium is
pre-installed; point Playwright at it with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node copo-de-nieve/build-icon-similarity.js`.
Locally, Playwright manages its own browser.

## When to rerun

- After the icon pool changes (a station added/removed in
  `STATION_ICON_SLUGS`, or a new entry in `station-icons.svg`).
- After editing any pictogram's artwork in `station-icons.svg`.
- After tuning the constants at the top of the script (`RENDER`, `FIELD`,
  `FIT`, `BLUR`, `TOP_K`, `UNFAIR_CAP`) — e.g. if the hardest rounds feel
  too easy, raise `UNFAIR_CAP`; if they feel unfair, lower it.

Output is deterministic (the pool is sorted), so an unchanged repo
regenerates an identical block — reruns only diff when something real
changed.
