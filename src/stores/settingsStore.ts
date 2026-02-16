import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark'
  protocolStartDate: string // ISO date string
  healthContext: string | null // null = use default
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setProtocolStartDate: (date: string) => void
  setHealthContext: (context: string | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      protocolStartDate: '2026-02-13',
      healthContext: null,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      setTheme: (theme) => set({ theme }),

      setProtocolStartDate: (date) => set({ protocolStartDate: date }),

      setHealthContext: (context) => set({ healthContext: context }),
    }),
    {
      name: 'cyto-settings',
    },
  ),
)
