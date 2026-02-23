# SDF Smooth-Union Goo Renderer — Design Document

> Replaces the current 2-pass density-field metaball renderer (Attempt 5 in `WEB_APP_APPROACHES_TRIED.md`) with a single-pass Signed Distance Field approach using Inigo Quilez's polynomial smooth minimum.

## 1. Technique Overview

The current renderer works by:
1. Rendering ~230 instanced quads (8 membrane blobs + ~225 bridge blobs) to a half-res RGBA16F FBO with additive blending to accumulate a density field
2. Rendering 8 nucleus quads to a second half-res RGBA16F FBO
3. Compositing both FBOs to screen with smoothstep threshold

The SDF approach replaces all three passes with **a single fullscreen fragment shader** that evaluates signed distance functions for every cell and connection, blends them with `smin()`, and outputs the final color directly. No framebuffer objects. No density accumulation. No blur/threshold dance. No texture reads. Pure math per pixel.

### Core idea

For each fragment (pixel):
1. Convert fragment position to world coordinates using the camera transform
2. Optionally displace the evaluation point with time-based noise (organic wobble)
3. Evaluate the SDF for every cell (circle) and every connection (capsule/segment)
4. Blend overlapping shapes using `smin()` — the polynomial smooth minimum
5. Use `smoothstep` on the final distance value for anti-aliased edges
6. Output color with alpha

### The smooth minimum function

From [Inigo Quilez](https://iquilezles.org/articles/smin/), the cubic polynomial smooth min:

```glsl
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}
```

Parameter `k` controls the blend radius — how far apart two surfaces can be and still merge smoothly. This is the single most important tuning knob: it replaces `gooContrast` / `gooThreshold` / `blurStdDev` from the density approach. Larger `k` = more generous merging = goopier look. Typical starting value: 20–40 CSS pixels.

Why `smin` over the density approach:
- **Exact boundaries**: SDF gives pixel-perfect distance. No half-res FBO aliasing.
- **Controllable merge**: `k` directly controls merge radius in world-space units. The density approach's merge radius depends on the interaction between blur radius, threshold, contrast, blob overlap count, and FBO resolution — a 5-variable tuning nightmare.
- **No FBO allocation**: Eliminates `RGBA16F` framebuffer compatibility issues and half-float extension requirements.
- **Resolution-independent**: Renders at native resolution. No upscaling artifacts from `FBO_SCALE = 0.5`.

---

## 2. SDF Primitives Needed

Three primitives cover everything:

### sdCircle — Cell membranes and nuclei

```glsl
float sdCircle(vec2 p, vec2 center, float radius) {
    return length(p - center) - radius;
}
```

Returns negative inside, zero on boundary, positive outside. Used for both membrane circles (larger radius) and nucleus circles (smaller radius).

### sdSegment — Tube connections (capsule shape)

```glsl
float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}
```

This produces a capsule (line segment with radius). The radius `r` is the tube half-width. The `h` parameter gives us the parametric position along the segment (0 at source, 1 at target) — we use this for color interpolation.

For connections with **variable width** (fillet profile — wider near cells, narrower in the middle), we evaluate the segment SDF but modulate the radius based on `h`:

```glsl
float sdTaperedSegment(vec2 p, vec2 a, vec2 b, float rA, float rB, float tubeR) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    // Fillet profile: wider at endpoints (rA, rB), narrower in middle (tubeR)
    float radius = mix(mix(rA, tubeR, smoothstep(0.0, 0.3, h)),
                       mix(tubeR, rB, smoothstep(0.7, 1.0, h)),
                       step(0.5, h));
    return length(pa - ba * h) - radius;
}
```

This replaces the current `sampleConnection()` width profile (hermite interpolation with fillet zones) with equivalent SDF math, evaluating the profile analytically rather than sampling it at 25 discrete points.

### smin — Smooth union

```glsl
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}
```

Applied pairwise across all shapes. The result is a single distance value that represents the smooth union of every cell and connection.

---

## 3. Layers

Two independent SDF evaluations per pixel, composited with alpha-over blending:

### Layer 1: Membrane (goo)

- **Shapes**: Cell circles at `membraneRadiusScale * layoutRadius` + connection capsules
- **smin k**: Large value (20–40px) for generous merging — this is what creates the "goo" look
- **Color**: Phase color per cell, gradient-interpolated along connections
- **Alpha**: `gooOpacity` from palette (currently ~0.28 light / ~0.35 dark)
- **Anti-aliasing**: `smoothstep(-aaWidth, aaWidth, -dist)` where `aaWidth ≈ 1.0 / u_camera.z` (1 CSS pixel)

### Layer 2: Nucleus

- **Shapes**: Cell circles at `nucleusRatioSvg * layoutRadius` (smaller than membrane)
- **smin k**: Very small or zero — nuclei should NOT merge with each other
- **Color**: Same phase color, slightly brighter (or same, controlled by opacity)
- **Alpha**: `nucleusOpacity` (currently 0.65)
- **Anti-aliasing**: Same smoothstep approach
- **Deformation**: Angle-dependent radius wobble using harmonics (2/3/5-lobe), same as current nucleus fragment shader

### Compositing (in-shader)

Both layers are evaluated in the same fragment shader. The nucleus layer composites over the membrane layer using standard alpha-over:

```glsl
// Evaluate both layers
float memDist = evaluateMembraneField(worldPos);
vec3 memColor = evaluateMembraneColor(worldPos);
float memAlpha = smoothstep(aaW, -aaW, memDist) * u_gooOpacity;

float nucDist = evaluateNucleusField(worldPos);
vec3 nucColor = evaluateNucleusColor(worldPos);
float nucAlpha = smoothstep(aaW, -aaW, nucDist) * u_nucOpacity;

// Alpha-over composite
float outA = nucAlpha + memAlpha * (1.0 - nucAlpha);
vec3 outC = outA > 0.001
    ? (nucColor * nucAlpha + memColor * memAlpha * (1.0 - nucAlpha)) / outA
    : vec3(0.0);

// Premultiplied alpha output
fragColor = vec4(outC * outA, outA);
```

This replaces two FBO passes + a composite pass with a single evaluation.

---

## 4. Color Blending

### The problem

When `smin` merges two shapes, we need the color to blend smoothly too. Standard SDF gives us a single distance value but loses track of which shapes contributed.

### Solution: Weighted color interpolation via individual distances

For each pixel, we track the SDF distance to each shape individually. The color contribution of each shape is weighted by a soft falloff from its distance:

```glsl
vec3 totalColor = vec3(0.0);
float totalWeight = 0.0;

for each shape i:
    float w = max(0.0, 1.0 - di / blendRadius);
    w = w * w;  // quadratic falloff
    totalColor += colors[i] * w;
    totalWeight += w;

vec3 finalColor = totalColor / max(totalWeight, 0.001);
```

This naturally blends colors in the merge zone. When a pixel is deep inside shape A and far from shape B, shape A's color dominates. In the merge zone, both contribute proportionally.

### Connection color gradients

Each connection tube blends between its source and target cell colors. The parametric position `h` from `sdSegment` gives us the blend factor:

```glsl
vec3 connColor = mix(sourceColor, targetColor, h);
```

The `h` value is already computed during the SDF evaluation (it's the clamped projection onto the segment), so color gradients come for free.

---

## 5. Organic Deformation

### Membrane wobble

Before evaluating the membrane SDF, displace the evaluation point with time-based noise:

```glsl
vec2 wobbledPos = worldPos;
wobbledPos.x += noise(worldPos * 0.01 + time * 0.3) * wobbleAmp;
wobbledPos.y += noise(worldPos * 0.01 + time * 0.3 + 100.0) * wobbleAmp;
```

This warps the entire membrane field — cells, connections, and merge zones all deform together organically. The displacement is coherent (nearby pixels deform similarly) because we use the world position as the noise seed.

**Per-cell variation**: Each cell gets a unique `breathePhase` and `deformFreq` (already in `BlobData`). We can animate the SDF radius per-cell rather than displacing the evaluation point:

```glsl
float breathe = sin(time * breatheSpeed + cell.breathePhase) * breatheAmp;
float deformA = sin(time * deformASpeed + cell.wobblePhase) * deformAAmp;
float r = cell.radius * membraneRadiusScale + breathe + deformA;
```

This is simpler than spatial displacement and matches the current renderer's behavior exactly (each cell breathes independently).

**Recommended approach**: Use **per-cell radius animation** for breathing (matches current behavior, cheaper) and optionally add **global spatial displacement** for extra organic feel. The spatial displacement is a new capability the density renderer couldn't easily do — it warps the merge zones themselves, making the goo look truly liquid.

### Nucleus wobble

The nucleus already has angle-dependent harmonic deformation (2/3/5-lobe). In the SDF approach, this modifies the effective radius:

```glsl
float angle = atan(p.y - center.y, p.x - center.x);
float r = baseRadius;
r += amp2 * sin(2.0 * angle + phase2);
r += amp3 * sin(3.0 * angle + phase3);
r += amp5 * sin(5.0 * angle + phase5);
r = clamp(r, baseRadius * 0.6, baseRadius * 1.25);
float dist = length(p - center) - r;
```

This exactly reproduces the current `NUC_DENSITY_FRAG` shader's behavior but as a true SDF. The distance value is slightly approximate (the gradient of an angle-modulated circle isn't exactly unit length), but the error is negligible for the small amplitudes we use.

### Noise implementation

For spatial displacement, we need a noise function in GLSL. Options:

1. **Simplex noise** (preferred): ~15 ALU ops per evaluation. Well-documented GLSL implementations. Smooth, no grid artifacts.
2. **Value noise with hash**: Cheaper (~8 ops) but has visible grid structure. Acceptable if masked by other animation.
3. **Sin-hash pseudo-noise**: `fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)` — cheapest, but not smooth. Adequate for subtle displacement.

Recommendation: Start with per-cell radius animation only (zero noise cost). Add simplex spatial displacement as an optional enhancement if the look needs it.

---

## 6. Data Passing

### Uniform layout

With ~9 cells and ~8 connections, the data fits comfortably in uniforms:

```
Per cell (9 cells max):
  vec2  center          2 floats
  float membraneRadius  1 float
  float nucleusRadius   1 float
  vec3  color           3 floats
  float breathePhase    1 float
  float wobblePhase     1 float
  float deformFreq      1 float
  ─────────────────────────────
  10 floats/cell × 9 = 90 floats

Per connection (12 connections max):
  vec2  sourcePos       2 floats
  vec2  targetPos       2 floats
  float sourceRadius    1 float  (fillet width at source end)
  float targetRadius    1 float  (fillet width at target end)
  float tubeRadius      1 float  (half-width in middle)
  vec3  sourceColor     3 floats
  vec3  targetColor     3 floats
  float phaseOffset     1 float  (for flow animation)
  float flowSpeed       1 float
  ─────────────────────────────
  15 floats/conn × 12 = 180 floats

Global uniforms:
  vec2  u_resolution    2 floats
  vec3  u_camera        3 floats  (x, y, scale)
  float u_time          1 float
  float u_sminK         1 float   (merge radius)
  float u_gooOpacity    1 float
  float u_nucOpacity    1 float
  float u_wobbleIntensity 1 float
  float u_aaWidth       1 float   (anti-aliasing pixel width)
  ─────────────────────────────
  10 floats

Total: ~280 floats
```

WebGL2 guarantees at minimum 1024 uniform vectors (4096 floats). We use ~280 — well within limits. No UBOs or texture-based data passing needed.

### Uniform packing strategy

Use `vec4` arrays for efficient upload:

```glsl
// Cells: pack as vec4 arrays
uniform vec4 u_cells[27];       // 9 cells × 3 vec4s each (12 floats, 2 padding)
uniform int  u_cellCount;

// Connections: pack as vec4 arrays
uniform vec4 u_connections[48]; // 12 connections × 4 vec4s each (16 floats, 1 padding)
uniform int  u_connectionCount;
```

JS side uploads via `gl.uniform4fv()` — one call per array, updated every frame.

### Update frequency

Cell data changes only on layout change (rare — resize, milestone status change). Connection data is similarly stable. **However**, breathing animation parameters change every frame (time-dependent radius offsets), so we update every frame regardless. The cost is ~2 `uniform4fv` calls per frame — negligible compared to draw call overhead.

---

## 7. Performance Analysis

### Current approach: 3-pass density field

```
Pass 1 — Goo density:
  ~230 instanced quads → half-res FBO (RGBA16F)
  Vertex: 4 verts × 230 instances = 920 vertex invocations
  Fragment: ~230 quads × average ~500 pixels each ≈ 115K fragment invocations
  Texture write: 1 FBO write per fragment

Pass 2 — Nucleus density:
  8 instanced quads → half-res FBO (RGBA16F)
  Vertex: 4 × 8 = 32 vertex invocations
  Fragment: 8 × ~2000 pixels = ~16K fragment invocations

Pass 3 — Composite:
  1 fullscreen quad, 2 texture reads per pixel
  Fragment: width × height pixels (e.g., 390×844 = 330K on iPhone)
  Ops/pixel: 2 texture reads + smoothstep + alpha-over ≈ 15 ALU ops

FBO overhead:
  2 × RGBA16F allocations at half-res
  2 × framebuffer binds + clears per frame
  2 × texture binds for composite pass

Total per frame:
  3 draw calls
  2 FBO binds/clears
  ~460K fragment invocations (across all passes)
  ~330K texture reads (composite pass)
  Half-res introduces aliasing on edges (visible at low zoom)
```

### New approach: Single-pass SDF

```
1 fullscreen quad
  Vertex: 4 vertex invocations
  Fragment: width × height pixels (330K on iPhone)

Per pixel ALU ops (9 cells + 8 connections):
  Camera transform:         4 ops
  Per cell (×9):
    sdCircle:               5 ops
    smin:                   8 ops
    color weight:           4 ops
    ────────────────────
    17 ops × 9 =          153 ops
  Per connection (×8):
    sdSegment:             12 ops
    smin:                   8 ops
    color interpolation:    6 ops
    ────────────────────
    26 ops × 8 =          208 ops
  Nucleus evaluation (×9):
    angle + harmonics:     20 ops
    sdCircle (modified):    8 ops
    ────────────────────
    28 ops × 9 =          252 ops
  Smoothstep + composite: 15 ops
  ────────────────────────────────
  Total:                 ~632 ops/pixel

At 330K pixels × 632 ops = ~209M ALU ops/frame

Comparison:
  Modern mobile GPUs (Adreno 619, Mali-G57): ~50-100 GFLOPS
  209M ops at 60fps = 12.5 GFLOPS — well within budget (~15-25% utilization)
  Desktop GPUs: trivial (<5% utilization)
```

### Early termination optimization

Most pixels are far from any cell. We can add a **bounding box early-out**:

```glsl
// Compute distance to nearest cell bounding box
float minBoxDist = 9999.0;
for (int i = 0; i < u_cellCount; i++) {
    vec2 d = abs(worldPos - cells[i].center) - vec2(cells[i].radius + u_sminK);
    minBoxDist = min(minBoxDist, max(d.x, d.y));
}
// If we're far from everything, skip the full evaluation
if (minBoxDist > 0.0) {
    fragColor = vec4(0.0);
    return;
}
```

For typical views where cells occupy ~30% of screen area, this skips ~70% of pixels entirely. Effective ALU load drops to ~63M ops/frame.

### Summary

| Metric | Current (density) | New (SDF) |
|--------|-------------------|-----------|
| Draw calls | 3 | 1 |
| FBO allocations | 2 × RGBA16F | 0 |
| Texture reads/frame | ~330K | 0 |
| Fragment invocations | ~460K | ~330K (100K after early-out) |
| ALU ops/pixel | ~15 (composite only) | ~632 (full eval) |
| Effective GFLOPS | ~2 + texture overhead | ~4–12 |
| Memory bandwidth | High (FBO read/write) | Near-zero |
| Edge quality | Half-res upscaled | Native resolution |
| GPU state changes | 3 program binds, 2 FBO binds | 1 program bind |

The SDF approach trades texture bandwidth for ALU compute — exactly the trade modern GPUs are designed for (ALU is cheap, memory is expensive). The single draw call and zero FBO overhead also eliminate pipeline stalls.

---

## 8. Migration Plan

### Files replaced entirely

| File | Action |
|------|--------|
| `src/components/BubbleMap/GooCanvas.tsx` | **Rewrite** — new SDF shader + simplified JS setup |

### Files modified

| File | Changes |
|------|---------|
| `src/components/BubbleMap/gooMath.ts` | Remove `sampleConnection()`, `blendHex()`, `blendVec3()` (bridge sampling no longer needed — SDF evaluates analytically). Keep `precomputeConnections()` (simplified — only needs endpoint positions/radii/colors, not sampling parameters). Keep `hexToVec3()`. Keep `BlobData` and `ConnectionData` types (simplified). |
| `src/stores/tuningStore.ts` | See "Tuning Parameters" below |
| `src/utils/performanceTier.ts` | Remove `gooSamplesPerPx`, `gooMinSegments`, `gooBlobSteps`, `gooNucleusSteps`. Keep `gooTargetDt`, `gooIdleDt`, `canvasDpr`. |
| `src/stores/debugStore.ts` | `gooFilter` toggle: repurpose to toggle SDF goo merge (sets `u_sminK` to 0). `filterBlurRadius` slider: repurpose to control `u_sminK` (merge radius). |

### Files unchanged

| File | Why |
|------|-----|
| `src/components/BubbleMap/BubbleMap.tsx` | `<GooCanvas>` props are identical — `width`, `height`, `bubbles`, `links`, `transform` |
| `src/components/BubbleMap/Bubble.tsx` | SVG labels/icons layer — no goo rendering |
| `src/components/BubbleMap/useBubbleLayout.ts` | Layout is independent of rendering approach |
| `src/components/BubbleMap/BackgroundParticles.tsx` | Independent layer |
| `src/components/BubbleMap/DotGrid.tsx` | Independent layer |
| `src/styles/theme.ts` | Color definitions unchanged |

### Tuning parameters

**Removed** (no longer meaningful in SDF approach):

| Parameter | Why removed |
|-----------|-------------|
| `blurStdDev` | No blur pass — SDF edges are analytically sharp |
| `gooContrast` | No density threshold — replaced by `sminK` |
| `gooThreshold` | Same — density threshold concept doesn't apply |
| `nucleusBlur` | No nucleus blur pass |
| `nucleusContrast` | No nucleus threshold |
| `nucleusThreshold` | Same |
| `nucleusRatioCanvas` | Was only used for canvas 2D fallback (long gone) |

**Survived** (same meaning, same values):

| Parameter | SDF usage |
|-----------|-----------|
| `tubeWidthRatio` | `tubeRadius = smallerCellRadius * tubeWidthRatio` |
| `filletWidthRatio` | `filletRadius = tubeRadius * filletWidthRatio` |
| `nucleusRatioSvg` | `nucleusRadius = layoutRadius * nucleusRatioSvg` |
| `nucleusOpacity` | `u_nucOpacity` uniform |
| `iconSizeRatio` | SVG layer — unchanged |
| `phaseNameFontSize` | SVG layer — unchanged |
| `phaseIndicatorFontSize` | SVG layer — unchanged |
| `particleCount` | Particles layer — unchanged |
| `particleSpreadX` | Particles layer — unchanged |
| `edgeWobbleSpeed` | Flow animation speed on connections |
| `edgeWobbleAmp` | Flow animation amplitude on connections |
| `membraneBreatheSpeed` | Per-cell radius oscillation speed |
| `membraneBreatheAmp` | Per-cell radius oscillation amplitude |
| `membraneDeformASpeed` | Per-cell secondary deform speed |
| `membraneDeformAAmp` | Per-cell secondary deform amplitude |
| `membraneDeformBSpeed` | Per-cell tertiary deform speed |
| `membraneDeformBAmp` | Per-cell tertiary deform amplitude |
| `membraneRadiusScale` | Membrane circle radius multiplier |
| `svgNucleusBreatheSpeed` | Nucleus breathing speed |
| `svgNucleusBreatheAmp` | Nucleus breathing amplitude |
| `svgNucleus2LobeSpeed` | 2-lobe harmonic speed |
| `svgNucleus2LobeAmp` | 2-lobe harmonic amplitude |
| `svgNucleus3LobeSpeed` | 3-lobe harmonic speed |
| `svgNucleus3LobeAmp` | 3-lobe harmonic amplitude |
| `svgNucleus5LobeSpeed` | 5-lobe harmonic speed |
| `svgNucleus5LobeAmp` | 5-lobe harmonic amplitude |

**New** (SDF-specific):

| Parameter | Purpose | Default |
|-----------|---------|---------|
| `sminK` | Smooth union merge radius in world-space px | 30.0 |
| `sminKNucleus` | Nucleus merge radius (0 = no merge) | 0.0 |

---

## 9. Camera / Transform Integration

### Current approach

The density renderer converts world positions to screen positions in the **vertex shader**:

```glsl
vec2 screen = worldPos * u_camera.z + u_camera.xy;
vec2 clip = screen / u_resolution * 2.0 - 1.0;
```

Each instanced quad is positioned in clip space. The camera transform scales/translates geometry.

### SDF approach

The SDF renderer does the **inverse** — it converts fragment positions to world coordinates in the **fragment shader**:

```glsl
// Fragment position in CSS pixels (0,0 = top-left)
vec2 screenPos = gl_FragCoord.xy / u_dpr;
// Flip Y: gl_FragCoord has Y=0 at bottom, CSS has Y=0 at top
screenPos.y = u_resolution.y - screenPos.y;
// Invert camera transform: screen → world
vec2 worldPos = (screenPos - u_camera.xy) / u_camera.z;
```

Where:
- `u_camera.xy` = pan offset in CSS pixels (same as `transform.x`, `transform.y`)
- `u_camera.z` = zoom scale (same as `transform.scale`)
- `u_resolution` = canvas CSS dimensions (same as `width`, `height`)
- `u_dpr` = device pixel ratio

All SDF evaluations happen in **world space**. Cell positions and radii are world-space values (from `useBubbleLayout`). The camera transform is applied once per pixel to convert screen → world, then all distance comparisons are in the same coordinate system as the layout.

### Vertex shader

Trivially simple — just a fullscreen quad:

```glsl
#version 300 es
in vec2 a_position;  // [-1,-1] to [1,1]
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
```

No camera uniform needed in the vertex shader. No per-instance data. Four vertices, one triangle strip.

---

## 10. DPR Handling

### The problem we fought

The density renderer had persistent DPR bugs because it operates at **three different resolutions**:

1. **CSS pixels** — where `transform.x/y/scale` live, where mouse events report coordinates
2. **Canvas buffer pixels** — `canvas.width = cssWidth * dpr`, where `gl.viewport` operates
3. **FBO pixels** — `fboW = canvasWidth * FBO_SCALE`, where density accumulation happens

Mismatches between these coordinate systems caused:
- Goo shapes offset from SVG labels (CSS ↔ canvas mismatch)
- Blurry edges (FBO upscaling)
- Resolution-dependent threshold behavior (density values change with FBO resolution)
- Touch/click coordinates not matching visual positions

### Why SDF inherently avoids this

The SDF fragment shader works exclusively in **world space** (CSS pixel coordinates). The DPR only appears in two places:

1. **Canvas buffer sizing**: `canvas.width = Math.round(cssWidth * dpr)` — determines how many physical pixels we render
2. **Screen → world conversion**: `gl_FragCoord.xy / u_dpr` converts physical pixels back to CSS pixels

After that single division, everything is in CSS/world coordinates. Cell radii, `sminK`, anti-aliasing width — all specified in CSS pixels. Doubling `dpr` doubles the number of fragment invocations (more physical pixels) but each fragment computes the same world-space position and produces the same color.

There is no intermediate FBO, so there is no third resolution to reconcile. There is no density accumulation, so there are no resolution-dependent threshold values. The SDF distance values are in world-space units regardless of how many physical pixels the canvas has.

### Anti-aliasing width

The smoothstep transition width should be ~1 CSS pixel regardless of DPR:

```glsl
float aaWidth = 1.0 / u_camera.z;  // 1 CSS pixel in world-space units
float alpha = smoothstep(aaWidth, -aaWidth, dist);
```

At higher DPR, more physical pixels fall within this 1-CSS-pixel transition, producing smoother edges. At DPR=1, the transition spans exactly one pixel — no aliasing. This is automatically correct without any DPR-specific logic.

---

## Appendix A: Fragment Shader Pseudocode

```glsl
#version 300 es
precision highp float;

uniform vec2  u_resolution;    // CSS pixel dimensions
uniform vec3  u_camera;        // (panX, panY, scale)
uniform float u_dpr;           // device pixel ratio
uniform float u_time;
uniform float u_sminK;         // goo merge radius (world px)
uniform float u_gooOpacity;
uniform float u_nucOpacity;
uniform float u_wobbleIntensity;

// Cell data: [center.x, center.y, memR, nucR, r, g, b, breathePhase, wobblePhase, deformFreq, pad, pad]
uniform vec4  u_cells[27];     // 9 cells × 3 vec4s
uniform int   u_cellCount;

// Connection data: [srcX, srcY, tgtX, tgtY, srcR, tgtR, tubeR, srcColorR, srcColorG, srcColorB, tgtColorR, tgtColorG, tgtColorB, phaseOff, flowSpd, pad]
uniform vec4  u_connections[48]; // 12 conns × 4 vec4s
uniform int   u_connectionCount;

// Nucleus harmonic data: [amp2, amp3, amp5, breatheAmp, phase2, phase3, phase5, breatheOff]
uniform vec4  u_nucleusHarmonics[18]; // 9 cells × 2 vec4s

out vec4 fragColor;

float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

void main() {
    // Screen → world
    vec2 sp = gl_FragCoord.xy / u_dpr;
    sp.y = u_resolution.y - sp.y;
    vec2 wp = (sp - u_camera.xy) / u_camera.z;

    float aaW = 1.0 / u_camera.z;

    // ── Membrane layer ──
    float memDist = 9999.0;
    vec3  memColor = vec3(0.0);
    float memWeightSum = 0.0;

    // Cells
    for (int i = 0; i < u_cellCount; i++) {
        vec2 center = u_cells[i * 3].xy;
        float baseR = u_cells[i * 3].z;
        vec3 color  = u_cells[i * 3 + 1].xyz;
        float bPhase = u_cells[i * 3 + 1].w;
        float wPhase = u_cells[i * 3 + 2].x;

        // Animated radius
        float breathe = sin(u_time * BREATHE_SPEED + bPhase) * BREATHE_AMP;
        float r = baseR + breathe * u_wobbleIntensity;

        float d = length(wp - center) - r;
        float w = max(0.0, 1.0 - d / (u_sminK * 2.0));
        w *= w;
        memColor += color * w;
        memWeightSum += w;
        memDist = smin(memDist, d, u_sminK);
    }

    // Connections
    for (int i = 0; i < u_connectionCount; i++) {
        // ... sdSegment + smin + color weighting ...
    }

    memColor /= max(memWeightSum, 0.001);
    float memAlpha = smoothstep(aaW, -aaW, memDist) * u_gooOpacity;

    // ── Nucleus layer ──
    float nucDist = 9999.0;
    vec3  nucColor = vec3(0.0);
    float nucWeightSum = 0.0;

    for (int i = 0; i < u_cellCount; i++) {
        // Angle-dependent harmonic radius + sdCircle
        // (no smin — nuclei don't merge)
        // ...
    }

    nucColor /= max(nucWeightSum, 0.001);
    float nucAlpha = smoothstep(aaW, -aaW, nucDist) * u_nucOpacity;

    // ── Composite ──
    float outA = nucAlpha + memAlpha * (1.0 - nucAlpha);
    vec3  outC = outA > 0.001
        ? (nucColor * nucAlpha + memColor * memAlpha * (1.0 - nucAlpha)) / outA
        : vec3(0.0);

    fragColor = vec4(outC * outA, outA);
}
```

## Appendix B: JS-side Setup (Simplified)

```
GooCanvas component (rewritten):
  1. Create canvas + WebGL2 context (same as now)
  2. Compile ONE program (fullscreen quad vert + SDF frag)
  3. Create ONE VBO (4 vertices for fullscreen quad)
  4. Create ONE VAO
  5. No FBOs
  6. No instanced rendering
  7. rAF loop:
     a. Read transform from ref
     b. Compute animated radii (breathing, wobble) in JS
     c. Pack cell/connection data into Float32Arrays
     d. Upload uniforms (uniform4fv × 2 + individual uniforms)
     e. gl.drawArrays(TRIANGLE_STRIP, 0, 4)
     f. Done
```

The JS-side complexity drops dramatically. No instance buffer management, no FBO lifecycle, no multi-pass state machine. The animation math (breathing, harmonic phases) can stay in JS or move to the shader — either works, with the shader being simpler to maintain since all animation is colocated with rendering.

## Appendix C: Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Fragment shader too complex for low-end mobile | Early termination (bounding box check) skips ~70% of pixels. Fallback: reduce `u_cellCount` for distant cells. |
| Loop unrolling needed on some drivers | Use `#define MAX_CELLS 9` with compile-time constants. Most WebGL2 drivers handle small uniform loops fine. |
| Floating point precision on mobile | Use `precision highp float` (required for world-space coordinates). All modern mobile GPUs support highp in fragment shaders. |
| Visual regression from different merge behavior | `sminK` is directly tunable. Start with value that matches current look, iterate. The merge behavior is more predictable than the density approach. |
| Loss of `gooFilter` toggle behavior | Setting `u_sminK = 0.0` disables all merging — cells and tubes render as discrete shapes. Equivalent to disabling the SVG goo filter. |
