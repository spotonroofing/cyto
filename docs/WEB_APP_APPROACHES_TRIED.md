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

### Attempt: CSS compositor hints for mobile (will-change, contain, content-visibility)
- **What:** Added mobile-only CSS hints to promote key elements to GPU-composited layers and limit repaint propagation. (1) `will-change: transform` on BubbleMap scroll container to keep it on its own compositor layer. (2) `will-change: contents` on both hidden SVG filter wrappers (`#goo-css`, `#nucleus-goo`) so the browser knows filter params change. (3) `contain: layout style paint` on each Bubble `<g>` to isolate repaints. (4) `content-visibility: auto` + `contain-intrinsic-size` on Bubble `<g>` elements so the browser can skip rendering off-screen bubbles during scroll. GooCanvas already had `will-change: transform` on mobile. All gated behind `IS_MOBILE` — desktop rendering untouched.
- **Result:** NEEDS VISUAL TESTING — zero functional changes, purely compositor/rendering hints. Requires mobile device testing to measure actual frame time improvement.

### Attempt: Snapshot goo during scroll (freeze filter on mobile scroll, resume on stop)
- **What:** During active touch scroll/pinch on mobile, GooCanvas stops all canvas drawing entirely — the rAF loop continues but only applies CSS transforms to reposition the last-drawn frame. Since canvas pixels never change, the browser caches the SVG filter output and CSS transforms operate at the composite stage for zero filter cost. A shared `mobileScrolling` signal (plain object in performanceTier.ts) is set by BubbleMap's touch handlers and read by GooCanvas's rAF loop. On touchend, a 150ms debounce (`SCROLL_FREEZE_DEBOUNCE_MS`) delays resume so rapid lift-touch-lift sequences stay frozen. On resume, a 200ms wake-up ramp (`SCROLL_RESUME_RAMP_MS`) gradually scales wobble intensity and animation time delta from 0→1, producing a smooth static→animated transition with no visual pop. If the user re-scrolls during the ramp, the freeze re-engages immediately and a fresh ramp starts on the next stop. Animation `time` is frozen (not advanced) during scroll so the goo resumes from the exact same state. All gated behind `IS_MOBILE` — desktop completely untouched. Layers on top of existing frame-skip and idle-freeze optimizations.
- **Result:** NEEDS VISUAL TESTING — compiles clean, logic integrates cleanly with existing mobile optimizations. Requires on-device verification for smoothness during fast scroll and seamless resume transition.
