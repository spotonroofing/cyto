/**
 * Device-aware quality tiers for the rendering pipeline.
 * Detected once at module load. All rendering components import from here.
 */

export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

/** Quality settings — mobile tier trades visual fidelity for 30fps+ performance */
export const Q = IS_MOBILE ? {
  // Canvas device pixel ratio — 1 on mobile (goo filter blurs away the detail anyway)
  canvasDpr: 1,

  // GooCanvas connection rendering
  gooSamplesPerPx: 7,        // samples per 100px of connection (was 9)
  gooMinSegments: 16,         // minimum segments per connection (was 24)
  gooBlobSteps: 16,           // polygon steps for blob outline (was 24)
  gooNucleusSteps: 16,        // polygon steps for nucleus outline (was 24)
  gooNucleusHarmonics: 3,     // harmonic count for nucleus deformation
  gooEdgeWobble: false as const, // skip per-edge sine wobble (path wobble still active)
  gooTargetDt: 1000 / 24,     // 24fps target (was 30fps)
  gooIdleDt: 1000 / 8,        // 8fps idle (was 10fps)

  // SVG goo filter blur — cap prevents quadratic cost explosion at high zoom
  baseBlurStdDev: 7,
  maxBlurStdDev: 8,

  // Background particles
  particleCount: 25,           // (was 30)
  particleTargetDt: 1000 / 20,

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
  gooTargetDt: 1000 / 45,
  gooIdleDt: 1000 / 10,

  baseBlurStdDev: 12,
  maxBlurStdDev: 999,          // effectively no cap on desktop

  particleCount: 105,
  particleTargetDt: 1000 / 30,

  dotDpr: 2,
  dotSpacing: 35,
}
