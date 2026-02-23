import { create } from 'zustand'

export const TUNING_DEFAULTS = {
  tubeWidthRatio: 0.240,
  filletWidthRatio: 2.20,
  blurStdDev: 16,
  nucleusRatioCanvas: 1,
  nucleusRatioSvg: 0.880,
  iconSizeRatio: 0.280,
  phaseNameFontSize: 16,
  phaseIndicatorFontSize: 12,
  particleCount: 300,
  particleSpreadX: 1.60,

  // Goo filter
  gooContrast: 14,
  gooThreshold: -4.0,

  // Nucleus filter
  nucleusBlur: 20,
  nucleusContrast: 18,
  nucleusThreshold: -7,

  // Edge wobble (multipliers on hardcoded constants)
  edgeWobbleSpeed: 2.65,
  edgeWobbleAmp: 5.5,

  // SVG nucleus animation
  svgNucleusBreatheSpeed: 0.650,
  svgNucleusBreatheAmp: 0.080,
  svgNucleus2LobeSpeed: 2.30,
  svgNucleus2LobeAmp: 0.030,
  svgNucleus3LobeSpeed: 0.450,
  svgNucleus3LobeAmp: 0.025,
  svgNucleus5LobeSpeed: 0.350,
  svgNucleus5LobeAmp: 0.015,
  nucleusOpacity: 0.780,

  // Membrane breathing
  membraneBreatheSpeed: 2,
  membraneBreatheAmp: 4.50,
  membraneDeformASpeed: 0.300,
  membraneDeformAAmp: 4.80,
  membraneDeformBSpeed: 0.250,
  membraneDeformBAmp: 3.20,
  membraneRotSpeed: -0.150,
  membraneRadiusScale: 1.18,
} as const

export type TuningKey = keyof typeof TUNING_DEFAULTS

export interface TuningState {
  // Bridge geometry
  tubeWidthRatio: number         // half-width = smallerR * this (default 0.24)
  filletWidthRatio: number       // filletWidth = tubeWidth * this (default 1.4)

  // Goo filter
  blurStdDev: number             // SVG filter stdDeviation (default 12)

  // Nucleus
  nucleusRatioCanvas: number     // canvas layer: nucleusR = blobR * this (default 0.782)
  nucleusRatioSvg: number        // SVG layer: nucleusR = radius * this (default 0.655)

  // Labels & icons
  iconSizeRatio: number          // icon = radius * this (default 0.28)
  phaseNameFontSize: number      // px (default 11)
  phaseIndicatorFontSize: number // px (default 8)

  // Particles
  particleCount: number          // base count before debug multiplier
  particleSpreadX: number        // multiplier on horizontal range (default 1.0)

  // Goo filter
  gooContrast: number            // feColorMatrix alpha multiplier (default 20)
  gooThreshold: number           // feColorMatrix alpha offset (default -8)

  // Nucleus filter
  nucleusBlur: number            // nucleus feGaussianBlur stdDeviation (default 3)
  nucleusContrast: number        // nucleus feColorMatrix alpha multiplier (default 18)
  nucleusThreshold: number       // nucleus feColorMatrix alpha offset (default -7)

  // Edge wobble
  edgeWobbleSpeed: number        // master speed multiplier on edge wobble (default 1.0)
  edgeWobbleAmp: number          // master amplitude multiplier on edge wobble (default 1.0)

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
