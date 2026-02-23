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
  gooIdleDt: 1000 / 60,       // match active — smooth wobble/breathing when idle (same as desktop)

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

  // Background particles
  particleCount: 105,
  particleTargetDt: 1000 / 30,

  // Bubble nucleus (SVG layer)
  bubbleTargetDt: 0,           // uncapped on desktop

  // Dot grid
  dotDpr: 2,
  dotSpacing: 35,
}
