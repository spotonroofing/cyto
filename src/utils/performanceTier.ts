/**
 * Device-aware quality tiers for the rendering pipeline.
 * Detected once at module load. All rendering components import from here.
 */

export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

/**
 * Shared mobile idle state — set by GooCanvas (owns the primary animation loop),
 * read by Bubble, BackgroundParticles, DotGrid to pause their own loops.
 * Using a plain object so reads in rAF hot paths are zero-cost (no function call).
 */
export const mobileIdle = { active: false }

/** Quality settings — mobile uses reduced resolution to cut SVG filter cost ~8x */
export const Q = IS_MOBILE ? {
  canvasDpr: 1,               // (was 2) — 4x fewer pixels for SVG filter to process

  // GooCanvas — reduced complexity (shapes are fewer pixels at low DPR anyway)
  gooSamplesPerPx: 6,         // (was 10) — fewer path segments per connection
  gooMinSegments: 20,         // (was 28)
  gooBlobSteps: 32,           // (was 48) — fewer vertices per blob circle
  gooNucleusSteps: 32,        // (was 64) — fewer vertices per nucleus
  gooNucleusHarmonics: 3,     // (was 5) — fewer harmonic calculations
  gooEdgeWobble: true as const,
  gooTargetDt: 1000 / 60,     // 60fps — ensures every frame draws on 60Hz displays
  gooIdleDt: 1000 / 60,       // match active — consistent wobble when idle

  // SVG goo filter blur (applied via CSS, browser handles DPR)
  // Runtime stdDev is scaled by (dpr / 2) in GooCanvas to compensate for lower DPR
  baseBlurStdDev: 12,

  // Background particles
  particleCount: 15,           // (desktop: 105) — minimal on mobile
  particleTargetDt: 1000 / 12, // ~12fps — half goo rate, non-critical layer

  // Bubble nucleus (SVG layer)
  bubbleTargetDt: 1000 / 4,   // 4fps nucleus animation on mobile (was uncapped)

  // Dot grid
  dotDpr: 1,                   // (was 2)
  dotSpacing: 50,              // (was 35) — fewer dots rendered
} : {
  canvasDpr: 2,

  gooSamplesPerPx: 10,
  gooMinSegments: 28,
  gooBlobSteps: 48,
  gooNucleusSteps: 64,
  gooNucleusHarmonics: 5,
  gooEdgeWobble: true as const,
  gooTargetDt: 1000 / 60,   // 60fps — ensures every frame draws on 60Hz displays
  gooIdleDt: 1000 / 60,     // match active — consistent wobble when idle

  // SVG goo filter blur (applied via CSS, browser handles DPR)
  baseBlurStdDev: 12,

  // Background particles
  particleCount: 105,
  particleTargetDt: 1000 / 30,

  // Bubble nucleus (SVG layer)
  bubbleTargetDt: 0,           // uncapped on desktop

  // Dot grid
  dotDpr: 2,
  dotSpacing: 35,
}
