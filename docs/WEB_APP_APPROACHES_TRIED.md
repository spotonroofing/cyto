# Approaches Tried — What Worked, What Failed, and Why

## Challenge: Goo Connections (Membrane Between Phases)

**Goal:** Organic, sticky biological connection between milestone circles.

### Attempt 1: Hiroyuki Sato Metaball Algorithm (SVG Paths)
- **What:** Mathematical metaball algorithm generating SVG path elements via tangent calculations.
- **Result:** FAILED
- **Why:** Static geometric shapes. Looked like "spider webs" / "thin lines." maxDist logic prevented rendering at 280px spacing.

### Attempt 2: SVG Filter (Gooey Effect) on Groups
- **What:** feGaussianBlur (stdDev 10-12) + feColorMatrix (alpha 18 -7) on a g containing all milestones.
- **Result:** FAILED
- **Why:** (1) "Orange borders" from contrast matrix on multi-colored elements. (2) Bridge circles appeared as discrete dots (spacing too wide vs blur radius). (3) Low opacity elements vanished (alpha * 18 - 7 clamps below ~0.4 to 0).

### Attempt 3: Canvas + SVG Hybrid (Current v8)
- **What:** Canvas draws tapered filled paths (wide at cell, narrow in middle) with sine-wave wobble. Global opacity 0.28. SVG goo filter on Canvas element. Separate SVG layer for nuclei/labels (unfiltered).
- **Result:** IN PROGRESS / Promising
- **Why:** Separating goo (canvas) from cell body (SVG) solved color fringe. Filled paths solved "dotted line" issue.

## Challenge: Organic Cell Shape

### Attempt 1: feTurbulence Filter
- **Result:** FAILED — 15fps on mobile. Animating seed regenerates Perlin noise every frame.

### Attempt 2: Catmull-Rom Blob Generation
- **Result:** FAILED — "Hexagons with rounded edges" or "pie pieces cut out." Too unstable.

### Attempt 3: CSS Border-Radius (Current)
- **Result:** SUCCESS — membrane-breathe keyframes. GPU-accelerated, smooth, organic.

## Challenge: Navigation / Pan + Zoom

### Attempt 1: Framer Motion drag
- **Result:** FAILED — Conflicted with D3 layout/click events.

### Attempt 2: Custom Handlers + motion.g
- **Result:** FAILED — Framer interpolates even with duration: 0, fights React state.

### Attempt 3: Native DOM Listeners + Plain g (Current)
- **Result:** SUCCESS — Bypasses React synthetic events and Framer interpolation.

## Challenge: Mobile Goo Filter Performance

**Goal:** Eliminate choppiness caused by the CSS SVG filter (feGaussianBlur + feColorMatrix + feBlend) being re-evaluated every animation frame on mobile. Desktop is fine; this is mobile-only.

### Attempt 1: Mobile goo frame throttle + CSS transform compensation (878d355, REVERTED)
- **What:** Skip 2 of every 3 canvas redraws on mobile (~20fps goo). On skipped frames, apply a CSS `transform` to reposition the cached filter bitmap to track scroll/zoom. CSS transforms happen at the composite stage (after filter), so the browser reuses the cached filter output.
- **Result:** FAILED — Reverted in ed70cba.
- **Why:** The filter output is position-dependent (blur/threshold boundaries baked at old camera position). CSS transform compensation creates visible misalignment between goo layer and SVG overlay during fast scroll. "Frame smearing" artifact.

### Attempt 2: Scroll-freeze snapshot (5343b3c, REVERTED)
- **What:** During active touch scroll, freeze all canvas drawing entirely. Apply CSS transform to reposition the last-drawn filtered frame. Resume with a 200ms wake-up ramp after 150ms debounce on touchend.
- **Result:** FAILED — Reverted in ed70cba.
- **Why:** Same fundamental issue as Attempt 1 — filter output at old camera position can't be cleanly remapped via CSS transform. Frame smearing when camera had moved significantly from last draw.

### Attempt 3: CSS compositor hints (d495b9b, REVERTED)
- **What:** Added `will-change: transform` on BubbleMap container, `will-change: contents` on SVG filter wrappers, `contain: layout style paint` on each Bubble `<g>`, `content-visibility: auto` on Bubble elements.
- **Result:** FAILED — No measurable improvement. Reverted in ed70cba.
- **Why:** Purely advisory hints. The bottleneck is raw pixel throughput of the SVG filter, not compositing strategy or repaint isolation.

### Attempt 4: Canvas DPR reduction + drawing complexity reduction (Current)
- **What:** Multi-layered mobile-only optimization attacking the SVG filter's pixel cost. All gated behind `IS_MOBILE` — desktop completely untouched.
  1. **Canvas DPR 2 → 1** (`performanceTier.ts`): Canvas backing store rendered at 1x instead of 2x. This means the SVG filter processes 4x fewer pixels (375×812 instead of 750×1624 on a typical phone). The blur `stdDeviation` is scaled by `dpr / 2` in the rAF loop to compensate — each canvas pixel is now 2x bigger on screen, so halving stdDev maintains the same visual blur radius. Because the goo is inherently blurred (stdDev 12 → kernel 72px), the resolution reduction is invisible — the blur destroys the extra detail anyway. Combined with the smaller kernel (2x fewer texture reads per pixel), total filter work drops ~8x.
  2. **Drawing complexity reduction** (`performanceTier.ts`): `gooSamplesPerPx` 10→6, `gooBlobSteps` 48→32, `gooNucleusSteps` 64→32, `gooNucleusHarmonics` 5→3, `gooMinSegments` 28→20. At lower DPR the shapes are fewer pixels — extra vertices are invisible. Frees main-thread CPU for scroll handling.
  3. **Flat connection colors** (`GooCanvas.tsx`): `createLinearGradient()` per connection replaced with flat midpoint blend color on mobile. Removes per-connection memory allocation and per-pixel gradient interpolation.
  4. **Faster idle freeze** (`GooCanvas.tsx`): Idle threshold reduced from 2000ms to 1000ms on mobile. Goo freezes 1s sooner after user stops scrolling, eliminating filter re-evaluation sooner.
- **Result:** NEEDS VISUAL TESTING — compiles clean, zero functional change to desktop path.
- **Expected improvement:** ~8x reduction in SVG filter GPU cost (primary bottleneck). Filter pixel-reads drop from ~87.7M/frame to ~10.9M/frame. Additional CPU savings from reduced drawing complexity and gradient removal. Should transform mobile from "very choppy" to smooth.
- **What to look for during testing:**
  - Goo blobs should look identical to desktop (soft, merged, organic). If they look blocky or the merge effect is weaker, the DPR may need to go back up to 1.5.
  - Connection colors are flat (no gradient) on mobile — should look fine since the midpoint color is used, but verify no jarring color jumps at phase boundaries.
  - Scroll through the phase map on mobile — should be noticeably smoother than before.
  - Initial fly-in animation should be smooth, not choppy.
  - Momentum after releasing a scroll should be fluid.
  - After 1s of no interaction, goo should freeze (subtle — breathing stops). Verify it resumes instantly on touch.
  - Desktop must be completely unchanged — verify on desktop browser.
- **Fallback if insufficient:** Can reduce DPR further to 0.75 (19x improvement) or 0.5 (63x improvement). If browser upscales canvas to device DPR before filtering (unlikely), switch to Canvas 2D `ctx.filter` API for explicit resolution control.
