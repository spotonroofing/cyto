/**
 * Device-aware quality tiers for the rendering pipeline.
 * Detected once at module load. All rendering components import from here.
 */

export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

/** Quality settings — mobile reduced for performance while preserving goo visual style */
export const Q = IS_MOBILE ? {
  canvasDpr: 1,                // 1x DPR — 4x fewer pixels; goo blur hides the lower res

  // GooCanvas — reduced polygon counts (goo blur hides the difference)
  gooSamplesPerPx: 10,
  gooMinSegments: 20,
  gooBlobSteps: 32,
  gooNucleusSteps: 40,
  gooNucleusHarmonics: 3,
  gooEdgeWobble: false as const, // skip edge wobble sin() calls — not visible at mobile res
  gooTargetDt: 1000 / 30,     // 30fps — smooth enough for organic wobble animation
  gooIdleDt: 1000 / 12,       // 12fps idle — saves battery, wobble barely perceptible

  // SVG goo filter blur (applied via CSS, browser handles DPR)
  baseBlurStdDev: 12,

  // Background particles
  particleCount: 15,           // (desktop: 105) — minimal on mobile
  particleTargetDt: 1000 / 12, // ~12fps — half goo rate, non-critical layer

  // Dot grid
  dotDpr: 1,
  dotSpacing: 50,
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

  // Dot grid
  dotDpr: 2,
  dotSpacing: 35,
}
