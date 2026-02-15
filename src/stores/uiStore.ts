import { create } from 'zustand'
import type { ViewState } from '@/types'

interface UIState {
  currentView: ViewState
  selectedMilestoneId: string | null
  isChatOpen: boolean
  isLogOpen: boolean
  isAnalyticsOpen: boolean
  isSettingsOpen: boolean

  setView: (view: ViewState) => void
  selectMilestone: (id: string | null) => void
  openChat: (milestoneContext?: string) => void
  closeChat: () => void
  toggleLog: () => void
  closeLog: () => void
  toggleAnalytics: () => void
  closeAnalytics: () => void
  toggleSettings: () => void
  closeSettings: () => void
  closeAllOverlays: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  currentView: 'map',
  selectedMilestoneId: null,
  isChatOpen: false,
  isLogOpen: false,
  isAnalyticsOpen: false,
  isSettingsOpen: false,

  setView: (view) => set({ currentView: view }),

  selectMilestone: (id) =>
    set({
      selectedMilestoneId: id,
      currentView: id ? 'milestone' : 'map',
    }),

  openChat: (_milestoneContext?: string) =>
    set({ isChatOpen: true }),

  closeChat: () => set({ isChatOpen: false }),

  toggleLog: () => set((s) => ({ isLogOpen: !s.isLogOpen })),
  closeLog: () => set({ isLogOpen: false }),

  toggleAnalytics: () => set((s) => ({ isAnalyticsOpen: !s.isAnalyticsOpen })),
  closeAnalytics: () => set({ isAnalyticsOpen: false }),

  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  closeSettings: () => set({ isSettingsOpen: false }),

  closeAllOverlays: () =>
    set({
      isChatOpen: false,
      isLogOpen: false,
      isAnalyticsOpen: false,
      isSettingsOpen: false,
    }),
}))
