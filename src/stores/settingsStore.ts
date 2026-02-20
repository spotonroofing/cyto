import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultThemeId } from '@/themes/palettes'

interface SettingsState {
  theme: 'light' | 'dark'
  themeId: string
  protocolStartDate: string // ISO date string
  healthContext: string | null // null = use default
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setThemeId: (id: string) => void
  setProtocolStartDate: (date: string) => void
  setHealthContext: (context: string | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      themeId: defaultThemeId,
      protocolStartDate: '2026-02-13',
      healthContext: null,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      setTheme: (theme) => set({ theme }),

      setThemeId: (id) => set({ themeId: id }),

      setProtocolStartDate: (date) => set({ protocolStartDate: date }),

      setHealthContext: (context) => set({ healthContext: context }),
    }),
    {
      name: 'cyto-settings',
    },
  ),
)
