/**
 * Device-aware quality tiers for the rendering pipeline.
 * Detected once at module load. All rendering components import from here.
 */

export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

/** Quality settings — mobile tier trades visual fidelity for 30fps+ performance */
export const Q = IS_MOBILE ? {
  // Canvas device pixel ratio — 1.5 on mobile (must stay above 1 to avoid
  // compositing/filter ghosting artifacts on high-DPR mobile browsers)
  canvasDpr: 1.5,

  // GooCanvas connection rendering
  gooSamplesPerPx: 7,        // samples per 100px of connection (desktop: 10)
  gooMinSegments: 12,         // minimum segments per connection (desktop: 28)
  gooBlobSteps: 12,           // polygon steps for blob outline (desktop: 48)
  gooNucleusSteps: 12,        // polygon steps for nucleus outline (desktop: 64)
  gooNucleusHarmonics: 3,     // harmonic count for nucleus deformation
  gooEdgeWobble: false as const, // skip per-edge sine wobble (path wobble still active)
  gooTargetDt: 1000 / 24,     // 24fps target
  gooIdleDt: 1000 / 8,        // 8fps idle
  gooCacheInterval: 5,         // update offscreen cache every 5 frames (~5fps wobble)
  gooCacheQuality: 0.5,        // half resolution offscreen (reduces filter cost ~4x)

  // SVG goo filter blur — must scale linearly with zoom (no cap) to keep goo
  // shape consistent across zoom levels. Capping breaks the feColorMatrix threshold.
  baseBlurStdDev: 7,
  maxBlurStdDev: 999,

  // Background particles
  particleCount: 15,           // (desktop: 105) — minimal on mobile
  particleTargetDt: 1000 / 12, // ~12fps — half goo rate, non-critical layer

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
  gooIdleDt: 1000 / 45,    // same as active — desktop has headroom, no idle throttle
  gooCacheInterval: 2,      // update offscreen cache every 2 frames (~22fps wobble)
  gooCacheQuality: 1.0,     // full resolution offscreen

  baseBlurStdDev: 12,
  maxBlurStdDev: 999,          // effectively no cap on desktop

  particleCount: 105,
  particleTargetDt: 1000 / 30,

  dotDpr: 2,
  dotSpacing: 35,
}
