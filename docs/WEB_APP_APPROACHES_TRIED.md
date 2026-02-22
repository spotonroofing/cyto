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

### Attempt 4: WebGL2 2-Pass Metaball Renderer (Mobile Only)
- **What:** Replaces Canvas 2D + CSS SVG filter pipeline with a WebGL2 2-pass metaball renderer, gated behind `IS_MOBILE`. Desktop keeps the existing Attempt 3 pipeline unchanged.
  - **Pass 1 — Density Field:** Each milestone blob and connection bridge blob is an instanced quad rendered to a half-resolution RGBA16F framebuffer with additive blending (`gl.ONE, gl.ONE`). The fragment shader outputs a quartic radial falloff (`f = (1 - dist²)²`) with color-weighted accumulation (`vec4(color * falloff, falloff)`).
  - **Pass 2 — Threshold:** A full-screen quad samples the density texture. Color is recovered via `RGB / A` (weighted average). A `smoothstep` threshold with antialiased edges produces the goo shape. The threshold/smoothness values map directly from the existing SVG filter's `gooContrast` and `gooThreshold` tuning params.
  - **Bridge Blobs:** Connections are sampled at 12 points using the same `sampleConnection()` math (curveBow, flowWave, fillet width profile). Each sample becomes a blob in the density field with radius = `width * 1.8` for overlap. This creates continuous goo bridges through density accumulation.
  - **Camera:** Transform `{x, y, scale}` is a `vec3` uniform in the vertex shader — pan/zoom is just a uniform update, no redraw of geometry.
  - **Fallback:** If WebGL2 context creation fails, the component calls `onFallback()` and BubbleMap switches to the Canvas 2D pipeline.
- **Result:** REVERTED (commit cf6263e)
- **Why:** Mobile-only scope was too narrow — didn't replace the per-bubble nucleus SVG filter (24 GPU filter passes/frame). Reverted in favor of a unified approach (Attempt 5).
- **File:** `src/components/BubbleMap/GooCanvasGL.tsx` (deleted)

### Attempt 5: Unified WebGL2 2-Pass Metaball Renderer (All Platforms)
- **What:** Replaces BOTH the goo Canvas 2D + CSS SVG filter AND the per-bubble nucleus SVG filter with a single WebGL2 canvas using 3 draw calls per frame on ALL platforms (desktop + mobile).
  - **Pass 1 — Goo Density:** 8 membrane blobs + ~225 bridge blobs rendered as instanced quads to a half-res RGBA16F FBO with additive blending. Quartic radial falloff `(1 - dist²)²` with color-weighted accumulation.
  - **Pass 2 — Nucleus Density:** 8 nuclei rendered to a separate half-res RGBA16F FBO with additive blending. Fragment shader computes angle-dependent radius from 4-harmonic wobble (breathe + 2/3/5-lobe harmonics) for organic cell shapes.
  - **Pass 3 — Composite:** Full-screen quad samples both density textures, applies independent smoothstep thresholds, composites nucleus over goo with alpha-over blending.
  - **Two FBOs:** The goo pass merges all shapes into one liquid mass. The nucleus pass gives each nucleus an independent soft edge WITHOUT merging them with each other or the goo layer. Two separate density fields with independent thresholds reproduce the original dual-filter behavior.
  - **Camera:** Transform `{x, y, scale}` as a `vec3` uniform — pan/zoom is just a uniform update.
  - **Bubble.tsx simplified:** Removed SVG nucleus `<path>`, rAF animation loop, and `filter="url(#nucleus-goo)"` wrapper. Only hit-target circle, phase icon, and text labels remain.
  - **SVG filter defs removed:** Both `#nucleus-goo` and `#goo-css` filter definitions removed from DOM.
  - **Shared math:** `sampleConnection()`, `blendHex()`, `hexToVec3()` extracted to `gooMath.ts`.
- **Result:** IN PROGRESS
- **Why:** Eliminates all SVG filter overhead. Previous approach had 27 GPU filter passes/frame (3 for goo + 24 for 8 nuclei × 3 passes each). New approach: 3 draw calls total with instanced rendering at half resolution. Nucleus wobble animation moves from JS rAF + SVG path recalculation to GPU fragment shader. Camera transform is a uniform update instead of full redraw + filter re-evaluation.
- **Files:** `src/components/BubbleMap/GooCanvas.tsx` (rewritten), `src/components/BubbleMap/gooMath.ts` (new), `src/components/BubbleMap/Bubble.tsx` (simplified), `src/components/BubbleMap/BubbleMap.tsx` (filter defs removed)

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
