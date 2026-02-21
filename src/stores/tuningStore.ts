import { create } from 'zustand'
import { Q } from '@/utils/performanceTier'

export const TUNING_DEFAULTS = {
  tubeWidthRatio: 0.24,
  filletWidthRatio: 1.4,
  blurStdDev: 12,
  nucleusRatioCanvas: 0.782,
  nucleusRatioSvg: 0.655,
  iconSizeRatio: 0.28,
  phaseNameFontSize: 11,
  phaseIndicatorFontSize: 8,
  particleCount: Q.particleCount,
  particleSpreadX: 1.0,
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

  set: <K extends TuningKey>(key: K, value: number) => void
  reset: () => void
}

export const useTuningStore = create<TuningState>()((set) => ({
  ...TUNING_DEFAULTS,
  set: (key, value) => set({ [key]: value }),
  reset: () => set(TUNING_DEFAULTS),
}))
