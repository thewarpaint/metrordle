'use strict';

// Precomputes a visual-similarity table for /diferente/'s station icons and
// bakes it into index.html (between the ICON_SIMILARITY markers). The game
// uses it to make each round progressively harder - the odd icon is drawn
// from the majority's most visually-similar neighbours as the score climbs.
//
// How similarity is measured: each station pictogram (a single-color path in
// station-icons.svg) is rasterized, cropped to its filled bounding box and
// rescaled into a fixed field (so position/scale don't matter - only shape;
// rotation/mirror are left intact, since those are fair tells at card size),
// lightly blurred (so near-misses score gracefully), then compared pairwise
// with a soft IoU (sum(min)/sum(max)) of the blurred silhouettes. Each icon
// keeps its top-K most-similar neighbours, excluding any pair above
// UNFAIR_CAP (near-identical pictograms would be impossible to tell apart at
// card size - "hard but fair", not "impossible").
//
// Rerun with:  node diferente/build-icon-similarity.js
// See build-icon-similarity.md for details. Needs Playwright (the repo's
// test dep) + a Chromium it can launch.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const INDEX = path.join(__dirname, 'index.html');
const SPRITE = path.join(REPO, 'station-icons.svg');
const SHARED = path.join(REPO, 'shared.js');

// Tunables.
const RENDER = 96;       // raster size each icon is drawn at
const FIELD = 56;        // normalized field the cropped icon is rescaled into
const FIT = 46;          // longer side of the icon inside the field
const BLUR = 1.1;        // px blur applied before comparison
const TOP_K = 28;        // neighbours kept per icon (most-similar first)
const UNFAIR_CAP = 0.90; // drop pairs more similar than this (too hard)

function playwright() {
  // The repo has no runtime deps; Playwright lives under tests/.
  return require(path.join(REPO, 'tests', 'node_modules', 'playwright'));
}

// Pull STATION_ICON_SLUGS out of shared.js (a plain string->string object
// literal) without executing the browser bundle.
function readPool() {
  const src = fs.readFileSync(SHARED, 'utf8');
  const m = src.match(/var STATION_ICON_SLUGS = (\{[\s\S]*?\});/);
  if (!m) throw new Error('could not find STATION_ICON_SLUGS in shared.js');
  const obj = new Function('return ' + m[1])();
  return Array.from(new Set(Object.values(obj))).filter(Boolean).sort();
}

async function main() {
  const { chromium } = playwright();
  const sprite = fs.readFileSync(SPRITE, 'utf8');
  const pool = readPool();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');

  const result = await page.evaluate(async (args) => {
    const { sprite, pool, RENDER, FIELD, FIT, BLUR, TOP_K, UNFAIR_CAP } = args;

    // Inline the sprite so each <symbol>'s markup is readable.
    const defs = document.createElement('div');
    defs.style.display = 'none';
    defs.innerHTML = sprite;
    document.body.appendChild(defs);

    function iconURL(slug) {
      const sym = defs.querySelector('#' + CSS.escape(slug));
      if (!sym) return null;
      const vb = sym.getAttribute('viewBox') || '0 0 1024 1024';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + RENDER +
        '" height="' + RENDER + '" viewBox="' + vb + '">' + sym.innerHTML + '</svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    function load(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    // Rasterize -> crop to content bbox -> rescale into FIELD (aspect kept,
    // centered) -> blur -> normalized [0,1] field.
    const rc = document.createElement('canvas'); rc.width = rc.height = RENDER;
    const rctx = rc.getContext('2d', { willReadFrequently: true });
    const fc = document.createElement('canvas'); fc.width = fc.height = FIELD;
    const fctx = fc.getContext('2d', { willReadFrequently: true });

    async function fieldFor(slug) {
      const url = iconURL(slug);
      if (!url) return null;
      const img = await load(url);
      if (!img) return null;
      rctx.clearRect(0, 0, RENDER, RENDER);
      rctx.drawImage(img, 0, 0, RENDER, RENDER);
      const data = rctx.getImageData(0, 0, RENDER, RENDER).data;
      let minX = RENDER, minY = RENDER, maxX = -1, maxY = -1;
      for (let y = 0; y < RENDER; y++) {
        for (let x = 0; x < RENDER; x++) {
          if (data[(y * RENDER + x) * 4 + 3] > 32) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null; // empty
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const scale = FIT / Math.max(bw, bh);
      const dw = bw * scale, dh = bh * scale;
      fctx.clearRect(0, 0, FIELD, FIELD);
      fctx.filter = 'blur(' + BLUR + 'px)';
      fctx.drawImage(img, minX, minY, bw, bh, (FIELD - dw) / 2, (FIELD - dh) / 2, dw, dh);
      fctx.filter = 'none';
      const fd = fctx.getImageData(0, 0, FIELD, FIELD).data;
      const field = new Float32Array(FIELD * FIELD);
      for (let i = 0; i < field.length; i++) field[i] = fd[i * 4 + 3] / 255;
      return field;
    }

    const slugs = [];
    const fields = [];
    for (const slug of pool) {
      const f = await fieldFor(slug);
      if (f) { slugs.push(slug); fields.push(f); }
    }

    function softIoU(a, b) {
      let inter = 0, uni = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        inter += x < y ? x : y;
        uni += x > y ? x : y;
      }
      return uni > 0 ? inter / uni : 0;
    }

    const neigh = [];
    for (let i = 0; i < fields.length; i++) {
      const sims = [];
      for (let j = 0; j < fields.length; j++) {
        if (j === i) continue;
        const s = softIoU(fields[i], fields[j]);
        if (s <= UNFAIR_CAP) sims.push([j, s]);
      }
      sims.sort((p, q) => q[1] - p[1]);
      neigh.push(sims.slice(0, TOP_K));
    }

    // A few most-similar pairs, for a sanity check in the console.
    const sample = [];
    for (let i = 0; i < neigh.length && sample.length < 8; i++) {
      if (neigh[i].length) sample.push([slugs[i], slugs[neigh[i][0][0]], +neigh[i][0][1].toFixed(2)]);
    }
    return { slugs, neigh: neigh.map((l) => l.map((e) => e[0])), sample };
  }, { sprite, pool, RENDER, FIELD, FIT, BLUR, TOP_K, UNFAIR_CAP });

  await browser.close();

  // Splice into index.html between the markers.
  const slugsLine = 'var SIM_SLUGS = ' + JSON.stringify(result.slugs) + ';';
  const neighLine = 'var SIM_NEIGH = [' + result.neigh.map((l) => '[' + l.join(',') + ']').join(',') + '];';
  const indent = '        ';
  const block = indent + slugsLine + '\n' + indent + neighLine;

  let html = fs.readFileSync(INDEX, 'utf8');
  const re = /(\/\/ ICON_SIMILARITY:START[^\n]*\n)[\s\S]*?(\n[ \t]*\/\/ ICON_SIMILARITY:END)/;
  if (!re.test(html)) throw new Error('ICON_SIMILARITY markers not found in index.html');
  html = html.replace(re, '$1' + block + '$2');
  fs.writeFileSync(INDEX, html);

  console.log('icons: ' + result.slugs.length + ', neighbours/icon: ' + TOP_K +
    ', dropped pairs > ' + UNFAIR_CAP + ' as unfair.');
  console.log('most-similar sample (slug -> nearest, soft-IoU):');
  result.sample.forEach((s) => console.log('  ' + s[0] + ' -> ' + s[1] + '  ' + s[2]));
  console.log('Wrote SIM_SLUGS/SIM_NEIGH into ' + path.relative(REPO, INDEX));
}

main().catch((e) => { console.error(e); process.exit(1); });
