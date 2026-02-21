import { create } from 'zustand'

export type ToggleKey =
  | 'gooFilter'
  | 'gooWobble'
  | 'nucleusWobble'
  | 'particles'
  | 'grid'
  | 'connectionGradients'
  | 'navButtonWobble'

export type SliderKey =
  | 'particleCount'
  | 'particleOpacity'
  | 'gooWobbleIntensity'
  | 'filterBlurRadius'
  | 'fpsCap'

interface DebugState {
  // Toggles (all default ON — no change to rendering)
  gooFilter: boolean
  gooWobble: boolean
  nucleusWobble: boolean
  particles: boolean
  grid: boolean
  connectionGradients: boolean
  navButtonWobble: boolean

  // Sliders (all default to neutral — no change to rendering)
  particleCount: number       // 0..2 multiplier (1 = 100% = default)
  particleOpacity: number     // 0..1 multiplier (1 = default)
  gooWobbleIntensity: number  // 0..2 multiplier (1 = 100% = default)
  filterBlurRadius: number    // 0..2 multiplier (1 = 100% = default)
  fpsCap: number              // 0 = use component defaults, or 10/15/30/60

  // Actions
  setToggle: (key: ToggleKey, value: boolean) => void
  setSlider: (key: SliderKey, value: number) => void
}

export const useDebugStore = create<DebugState>()((set) => ({
  gooFilter: true,
  gooWobble: true,
  nucleusWobble: true,
  particles: true,
  grid: true,
  connectionGradients: true,
  navButtonWobble: true,

  particleCount: 1,
  particleOpacity: 1,
  gooWobbleIntensity: 1,
  filterBlurRadius: 1,
  fpsCap: 0,

  setToggle: (key, value) => set({ [key]: value }),
  setSlider: (key, value) => set({ [key]: value }),
}))
