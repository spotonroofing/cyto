import { create } from 'zustand'

export const TUNING_DEFAULTS = {
  tubeWidthRatio: 0.175,
  filletWidthRatio: 1.50,
  nucleusRatioSvg: 0.780,
  iconSizeRatio: 0.280,
  phaseNameFontSize: 16,
  phaseIndicatorFontSize: 12,
  particleCount: 300,
  particleSpreadX: 1.60,

  // SDF smooth-union
  sminK: 45.0,
  sminKNucleus: 0.0,

  // Edge wobble (multipliers on hardcoded constants)
  edgeWobbleSpeed: 2.65,
  edgeWobbleAmp: 4.0,

  // SVG nucleus animation
  svgNucleusBreatheSpeed: 0.650,
  svgNucleusBreatheAmp: 0.080,
  svgNucleus2LobeSpeed: 2.30,
  svgNucleus2LobeAmp: 0.030,
  svgNucleus3LobeSpeed: 0.450,
  svgNucleus3LobeAmp: 0.025,
  svgNucleus5LobeSpeed: 0.350,
  svgNucleus5LobeAmp: 0.015,
  nucleusOpacity: 0.650,

  // Membrane breathing
  membraneBreatheSpeed: 2,
  membraneBreatheAmp: 2.40,
  membraneDeformASpeed: 0.300,
  membraneDeformAAmp: 3.40,
  membraneDeformBSpeed: 0.250,
  membraneDeformBAmp: 2.40,
  membraneRotSpeed: -0.150,
  membraneRadiusScale: 1.07,
} as const

export type TuningKey = keyof typeof TUNING_DEFAULTS

export interface TuningState {
  // Bridge geometry
  tubeWidthRatio: number         // half-width = smallerR * this (default 0.175)
  filletWidthRatio: number       // filletWidth = tubeWidth * this (default 1.5)

  // Nucleus
  nucleusRatioSvg: number        // nucleusR = radius * this (default 0.78)

  // Labels & icons
  iconSizeRatio: number          // icon = radius * this (default 0.28)
  phaseNameFontSize: number      // px (default 16)
  phaseIndicatorFontSize: number // px (default 12)

  // Particles
  particleCount: number          // base count before debug multiplier
  particleSpreadX: number        // multiplier on horizontal range (default 1.6)

  // SDF smooth-union
  sminK: number                  // merge radius in world-space px (default 45.0)
  sminKNucleus: number           // nucleus merge radius (0 = no merge) (default 0.0)

  // Edge wobble
  edgeWobbleSpeed: number        // master speed multiplier on edge wobble (default 2.65)
  edgeWobbleAmp: number          // master amplitude multiplier on edge wobble (default 4.0)

  // SVG nucleus animation
  svgNucleusBreatheSpeed: number // breathing speed (default 0.8)
  svgNucleusBreatheAmp: number   // breathing amplitude ratio (default 0.025)
  svgNucleus2LobeSpeed: number   // 2-lobe deform speed (default 0.6)
  svgNucleus2LobeAmp: number     // 2-lobe deform amplitude ratio (default 0.035)
  svgNucleus3LobeSpeed: number   // 3-lobe deform speed (default 0.45)
  svgNucleus3LobeAmp: number     // 3-lobe deform amplitude ratio (default 0.025)
  svgNucleus5LobeSpeed: number   // 5-lobe deform speed (default 0.35)
  svgNucleus5LobeAmp: number     // 5-lobe deform amplitude ratio (default 0.015)
  nucleusOpacity: number         // nucleus fill opacity (default 0.7)

  // Membrane breathing
  membraneBreatheSpeed: number   // breathing sine speed (default 0.5)
  membraneBreatheAmp: number     // breathing amplitude (default 3.6)
  membraneDeformASpeed: number   // deform A speed (default 0.3)
  membraneDeformAAmp: number     // deform A amplitude (default 3.6)
  membraneDeformBSpeed: number   // deform B speed (default 0.25)
  membraneDeformBAmp: number     // deform B amplitude (default 2.4)
  membraneRotSpeed: number       // rotation speed (default -0.15)
  membraneRadiusScale: number    // membrane radius multiplier (default 1.07)

  set: <K extends TuningKey>(key: K, value: number) => void
  reset: () => void
}

export const useTuningStore = create<TuningState>()((set) => ({
  ...TUNING_DEFAULTS,
  set: (key, value) => set({ [key]: value }),
  reset: () => set(TUNING_DEFAULTS),
}))
