/**
 * Device-aware quality tiers for the rendering pipeline.
 * Detected once at module load. All rendering components import from here.
 */

export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

/** Quality settings — mobile matches desktop for goo rendering (visual correctness first) */
export const Q = IS_MOBILE ? {
  canvasDpr: 2,

  // GooCanvas — identical to desktop for visual parity
  gooSamplesPerPx: 10,
  gooMinSegments: 28,
  gooBlobSteps: 48,
  gooNucleusSteps: 64,
  gooNucleusHarmonics: 5,
  gooEdgeWobble: true as const,
  gooTargetDt: 1000 / 60,     // 60fps — ensures every frame draws on 60Hz displays
  gooIdleDt: 1000 / 60,       // match active — consistent wobble when idle
  gooCacheInterval: 1,         // update cache every frame for smooth wobble
  gooCacheQuality: 1.0,

  // SVG goo filter blur — must scale linearly with zoom (no cap) to keep goo
  // shape consistent across zoom levels. Capping breaks the feColorMatrix threshold.
  baseBlurStdDev: 12,
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
  gooTargetDt: 1000 / 60,   // 60fps — ensures every frame draws on 60Hz displays
  gooIdleDt: 1000 / 60,     // match active — consistent wobble when idle
  gooCacheInterval: 1,       // update cache every frame for smooth wobble
  gooCacheQuality: 1.0,      // full resolution offscreen

  baseBlurStdDev: 12,
  maxBlurStdDev: 999,          // effectively no cap on desktop

  particleCount: 105,
  particleTargetDt: 1000 / 30,

  dotDpr: 2,
  dotSpacing: 35,
}
