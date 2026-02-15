import { create } from 'zustand'
import { db, type StoredActionItemState, type StoredMilestoneNote } from '@/lib/db'
import { actionItems as defaultActionItems, milestones, phases } from '@/data/roadmap'
import { syncStateToServer } from '@/utils/stateSync'
import type { ActionItem, Milestone, MilestoneStatus } from '@/types'

interface RoadmapState {
  // Action item states (merged from defaults + IndexedDB overrides)
  actionItemStates: Map<string, StoredActionItemState>
  milestoneNotes: StoredMilestoneNote[]
  initialized: boolean

  // Actions
  initialize: () => Promise<void>
  toggleActionItem: (id: string) => Promise<void>
  setFoodTrialOutcome: (id: string, outcome: 'pass' | 'fail') => Promise<void>
  addMilestoneNote: (milestoneId: string, content: string) => Promise<void>
  deleteMilestoneNote: (noteId: string) => Promise<void>

  // Derived getters
  getActionItem: (id: string) => ActionItem
  getActionItemsForMilestone: (milestoneId: string) => ActionItem[]
  getMilestoneProgress: (milestoneId: string) => { completed: number; total: number; percentage: number }
  getMilestoneStatus: (milestoneId: string) => MilestoneStatus
  getNotesForMilestone: (milestoneId: string) => StoredMilestoneNote[]
  getOverallProgress: () => { completed: number; total: number; percentage: number }
  getPhaseProgress: (phaseId: string) => { completed: number; total: number; percentage: number }
  getCurrentMilestone: () => Milestone | undefined
}

export const useRoadmapStore = create<RoadmapState>()((set, get) => ({
  actionItemStates: new Map(),
  milestoneNotes: [],
  initialized: false,

  initialize: async () => {
    const stored = await db.actionItemStates.toArray()
    const stateMap = new Map<string, StoredActionItemState>()
    for (const s of stored) {
      stateMap.set(s.id, s)
    }
    const notes = await db.milestoneNotes.orderBy('timestamp').toArray()
    set({ actionItemStates: stateMap, milestoneNotes: notes, initialized: true })
  },

  toggleActionItem: async (id: string) => {
    const current = get().actionItemStates.get(id)
    const isCompleted = current?.completed ?? false
    const newState: StoredActionItemState = {
      id,
      completed: !isCompleted,
      completedDate: !isCompleted ? new Date().toISOString().split('T')[0] : undefined,
    }
    await db.actionItemStates.put(newState)
    set((state) => {
      const newMap = new Map(state.actionItemStates)
      newMap.set(id, newState)
      return { actionItemStates: newMap }
    })
    syncStateToServer()
  },

  setFoodTrialOutcome: async (id: string, outcome: 'pass' | 'fail') => {
    const current = get().actionItemStates.get(id)
    const newState: StoredActionItemState = {
      id,
      completed: true,
      completedDate: new Date().toISOString().split('T')[0],
      foodTrialOutcome: outcome,
      ...(current?.notes ? { notes: current.notes } : {}),
    }
    await db.actionItemStates.put(newState)
    set((state) => {
      const newMap = new Map(state.actionItemStates)
      newMap.set(id, newState)
      return { actionItemStates: newMap }
    })
    syncStateToServer()
  },

  addMilestoneNote: async (milestoneId: string, content: string) => {
    const note: StoredMilestoneNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      milestoneId,
      content,
      timestamp: Date.now(),
    }
    await db.milestoneNotes.put(note)
    set((state) => ({ milestoneNotes: [...state.milestoneNotes, note] }))
    syncStateToServer()
  },

  deleteMilestoneNote: async (noteId: string) => {
    await db.milestoneNotes.delete(noteId)
    set((state) => ({
      milestoneNotes: state.milestoneNotes.filter((n) => n.id !== noteId),
    }))
    syncStateToServer()
  },

  getActionItem: (id: string) => {
    const defaultItem = defaultActionItems.find((a) => a.id === id)
    if (!defaultItem) throw new Error(`Action item not found: ${id}`)
    const stored = get().actionItemStates.get(id)
    if (!stored) return defaultItem
    return {
      ...defaultItem,
      completed: stored.completed,
      completedDate: stored.completedDate,
      ...(stored.foodTrialOutcome && defaultItem.foodTrial
        ? { foodTrial: { ...defaultItem.foodTrial, outcome: stored.foodTrialOutcome } }
        : {}),
    }
  },

  getActionItemsForMilestone: (milestoneId: string) => {
    return defaultActionItems
      .filter((a) => a.milestoneId === milestoneId)
      .map((a) => get().getActionItem(a.id))
  },

  getMilestoneProgress: (milestoneId: string) => {
    const items = get().getActionItemsForMilestone(milestoneId)
    const completed = items.filter((a) => a.completed).length
    return {
      completed,
      total: items.length,
      percentage: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
    }
  },

  getMilestoneStatus: (milestoneId: string) => {
    const milestone = milestones.find((m) => m.id === milestoneId)
    if (!milestone) return 'not_started'

    const { completed, total } = get().getMilestoneProgress(milestoneId)

    if (completed === total && total > 0) return 'completed'
    if (completed > 0) return 'in_progress'

    // Check if blocked by dependencies
    const items = get().getActionItemsForMilestone(milestoneId)
    const allDeps = items.flatMap((a) => a.dependsOn)
    const uniqueDeps = [...new Set(allDeps)]

    if (uniqueDeps.length > 0) {
      const allDepsComplete = uniqueDeps.every((depId) => {
        const depItem = get().getActionItem(depId)
        return depItem.completed
      })
      if (!allDepsComplete) return 'blocked'
    }

    return 'not_started'
  },

  getNotesForMilestone: (milestoneId: string) => {
    return get().milestoneNotes.filter((n) => n.milestoneId === milestoneId)
  },

  getOverallProgress: () => {
    let completed = 0
    let total = 0
    for (const item of defaultActionItems) {
      total++
      const stored = get().actionItemStates.get(item.id)
      if (stored?.completed) completed++
    }
    return {
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    }
  },

  getPhaseProgress: (phaseId: string) => {
    const items = defaultActionItems.filter((a) => a.phaseId === phaseId)
    let completed = 0
    for (const item of items) {
      const stored = get().actionItemStates.get(item.id)
      if (stored?.completed) completed++
    }
    return {
      completed,
      total: items.length,
      percentage: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
    }
  },

  getCurrentMilestone: () => {
    // Find the first milestone that is in_progress or not_started (but not blocked)
    for (const ms of milestones) {
      const status = get().getMilestoneStatus(ms.id)
      if (status === 'in_progress') return ms
    }
    // If nothing is in progress, find first non-blocked, non-completed
    for (const ms of milestones) {
      const status = get().getMilestoneStatus(ms.id)
      if (status === 'not_started') return ms
    }
    // Everything is done or blocked — return last milestone
    return milestones[milestones.length - 1]
  },
}))

// Re-export for convenience
export { phases, milestones, defaultActionItems as actionItems }
