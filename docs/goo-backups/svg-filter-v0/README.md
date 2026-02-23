# SVG Filter Goo Renderer (v0)

Documentation of the original SVG filter-based goo rendering pipeline, used
before the WebGL2 rewrite (commit `cc318f2`).

## Source Locations

- **Branch:** `goo-svg-filter-baseline` (tip: `885e6a1`) — most complete version
  with tuning panel, dynamic blur scaling, mobile idle optimization.
- **File backup:** `src/rendering/goo-backup/` (commit `1f77c3d`) — older snapshot
  without tuning panel integration.
- **Key files on branch:** `GooCanvas.tsx`, `BubbleMap.tsx`, `Bubble.tsx`,
  `performanceTier.ts`, `useBubbleLayout.ts`, `globals.css`.

## Rendering Technique

Canvas 2D + CSS SVG filter hybrid:

1. **Canvas 2D layer** draws membrane blobs (circles with breathing animation)
   and connection bridges (tapered filled paths with sine-wave wobble).
2. **CSS `filter: url(#goo-css)`** on the `<canvas>` element applies:
   - `feGaussianBlur` (stdDeviation 12, dynamically scaled with zoom)
   - `feColorMatrix` (alpha: `contrast * a + threshold`, default `20a - 8`)
   - `feBlend` compositing blurred result with source
3. **Separate SVG layer** (unfiltered) renders nuclei, labels, icons on top.
4. **Per-nucleus filter** (`#nucleus-goo`): each nucleus `<path>` wrapped in a
   `<g filter="url(#nucleus-goo)">` with its own blur(3) + colorMatrix(18, -7).

## How It Created the Goo Effect

The classic "SVG goo" trick: blur merges nearby shapes into a single mass, then
a high-contrast alpha color matrix (`values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0
0 0 0 20 -8"`) snaps the blurred alpha back to a hard edge. Where shapes overlap,
their blurred alphas sum past the threshold, fusing them into one organic blob.

## Performance Characteristics

- **GPU filter passes per frame:** 27+ (3 passes for goo filter on canvas + 8
  nuclei x 3 passes each for per-nucleus filters).
- **Mobile:** Required a lighter filter variant (`stdDeviation=7`, `18a - 7`)
  and idle-freeze optimization to maintain acceptable FPS.
- **Zoom scaling:** `stdDeviation` had to be dynamically recalculated with zoom
  level to keep goo thickness consistent — an SVG filter re-parse each time.
- **FPS:** ~45-50fps desktop, ~25-35fps mobile (iPhone 13-class).

## Why It Was Abandoned

1. **27+ GPU filter passes/frame** — the per-nucleus SVG filters alone consumed
   24 passes (8 nuclei x 3 filter primitives each).
2. **No batching** — SVG filters run per-element, can't be instanced.
3. **Mobile performance** — frame drops during pan/zoom were noticeable.
4. **Zoom coupling** — blur stdDeviation had to scale with camera zoom, causing
   filter re-creation overhead.
5. **Color fringe** — high-contrast alpha matrix on multi-colored elements
   produced orange/muddy edge artifacts until canvas separation fixed it.

## Visual Strengths (vs WebGL)

- Softer, more organic edge quality from true Gaussian blur.
- Simpler implementation (~500 lines vs ~640 for WebGL).
- No shader compilation or FBO setup — works everywhere SVG filters work.

## Visual Weaknesses (vs WebGL)

- Discrete bridge blobs visible at low zoom ("dotted line" artifact).
- Per-nucleus filters couldn't have harmonic deformation (only blur-based wobble).
- No adaptive anti-aliasing (fwidth trick) — edges either too soft or too hard.
- Color blending between connected phases was less smooth.
