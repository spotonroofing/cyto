import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultThemeId } from '@/themes/palettes'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface SettingsState {
  theme: 'light' | 'dark'
  themeId: string
  protocolStartDate: string // ISO date string
  healthContext: string | null // null = use default
  initialized: boolean
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setThemeId: (id: string) => void
  setProtocolStartDate: (date: string) => void
  setHealthContext: (context: string | null) => void
  initialize: () => Promise<void>
}

async function syncToServer(key: string, value: any) {
  try {
    await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
  } catch (err) {
    console.warn('Failed to sync settings to server:', err)
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      themeId: defaultThemeId,
      protocolStartDate: '2026-02-12',
      healthContext: null,
      initialized: false,

      initialize: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/settings`)
          if (res.ok) {
            const serverSettings = await res.json()
            set({
              protocolStartDate: serverSettings.protocolStartDate ?? get().protocolStartDate,
              healthContext: serverSettings.healthContext ?? get().healthContext,
              initialized: true,
            })
            return
          }
        } catch (err) {
          console.warn('Failed to fetch settings from server, using local:', err)
        }
        set({ initialized: true })
      },

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      setTheme: (theme) => set({ theme }),

      setThemeId: (id) => set({ themeId: id }),

      setProtocolStartDate: (date) => {
        set({ protocolStartDate: date })
        syncToServer('protocolStartDate', date)
      },

      setHealthContext: (context) => {
        set({ healthContext: context })
        syncToServer('healthContext', context)
      },
    }),
    {
      name: 'cyto-settings',
    },
  ),
)
