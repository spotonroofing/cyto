import { create } from 'zustand'

interface SleepSession {
  sleep_start: string
  sleep_end: string
  duration_hours: number
  total_sleep?: number
  deep?: number
  rem?: number
  core?: number
}

interface NutritionDay {
  date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sugar_g?: number
}

interface WeightEntry {
  date: string
  weight_lbs: number
}

interface HealthDataState {
  sleep: SleepSession[]
  nutrition: NutritionDay[]
  weight: WeightEntry[]
  loading: boolean
  error: string | null

  fetchSleepRange: (start: string, end: string) => Promise<void>
  fetchNutritionRange: (start: string, end: string) => Promise<void>
  fetchWeightRange: (start: string, end: string) => Promise<void>
  fetchAll: (start: string, end: string) => Promise<void>
}

const API_BASE = import.meta.env.VITE_API_URL || ''

export const useHealthDataStore = create<HealthDataState>()((set) => ({
  sleep: [],
  nutrition: [],
  weight: [],
  loading: false,
  error: null,

  fetchSleepRange: async (start: string, end: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/health/sleep/range?start=${start}&end=${end}`)
      if (!res.ok) throw new Error(`Sleep fetch failed: ${res.statusText}`)
      const json = await res.json()
      set({ sleep: json.data ?? [], loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  fetchNutritionRange: async (start: string, end: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/health/nutrition/range?start=${start}&end=${end}`)
      if (!res.ok) throw new Error(`Nutrition fetch failed: ${res.statusText}`)
      const json = await res.json()
      set({ nutrition: json.data ?? [], loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  fetchWeightRange: async (start: string, end: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/health/weight/range?start=${start}&end=${end}`)
      if (!res.ok) throw new Error(`Weight fetch failed: ${res.statusText}`)
      const json = await res.json()
      set({ weight: json.data ?? [], loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  fetchAll: async (start: string, end: string) => {
    set({ loading: true, error: null })
    try {
      const [sleepRes, nutritionRes, weightRes] = await Promise.all([
        fetch(`${API_BASE}/api/health/sleep/range?start=${start}&end=${end}`),
        fetch(`${API_BASE}/api/health/nutrition/range?start=${start}&end=${end}`),
        fetch(`${API_BASE}/api/health/weight/range?start=${start}&end=${end}`),
      ])

      if (!sleepRes.ok || !nutritionRes.ok || !weightRes.ok) {
        throw new Error('One or more health data fetches failed')
      }

      const [sleepJson, nutritionJson, weightJson] = await Promise.all([
        sleepRes.json(),
        nutritionRes.json(),
        weightRes.json(),
      ])

      set({
        sleep: sleepJson.data ?? [],
        nutrition: nutritionJson.data ?? [],
        weight: weightJson.data ?? [],
        loading: false,
      })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },
}))
