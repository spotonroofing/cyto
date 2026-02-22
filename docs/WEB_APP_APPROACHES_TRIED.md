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

**Goal:** Reduce choppiness caused by the CSS SVG filter (feGaussianBlur + feColorMatrix) being re-evaluated every animation frame on mobile.

### Attempt: Mobile goo frame throttle (20fps goo, 60fps scroll)
- **What:** Added a frame counter (`MOBILE_FRAME_SKIP = 3`) in GooCanvas.tsx's rAF loop. On mobile, only every 3rd frame does a full canvas redraw (triggering filter re-evaluation). On the 2 skipped frames, the cached filter output is repositioned via a CSS `transform` (translate + scale) computed from the delta between the current camera transform and the last-drawn transform. CSS transforms are applied at the composite stage (after filter), so the browser reuses the cached filter bitmap — no GPU shader passes. Canvas element gets `will-change: transform` and `transform-origin: 0 0` on mobile to ensure cheap GPU compositing. Desktop path is completely unchanged.
- **Result:** NEEDS VISUAL TESTING — compiles clean, logic is sound, but requires on-device verification for smoothness and correctness during pan/zoom.
