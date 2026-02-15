import { create } from 'zustand'
import { db } from '@/lib/db'
import { syncStateToServer } from '@/utils/stateSync'
import type { DailyLog } from '@/types'

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

interface DailyLogState {
  logs: DailyLog[]
  initialized: boolean

  initialize: () => Promise<void>
  saveLog: (log: DailyLog) => Promise<void>
  getLogForDate: (date: string) => DailyLog | undefined
  getRecentLogs: (days: number) => DailyLog[]
  deleteLog: (date: string) => Promise<void>
}

function createEmptyLog(date: string): DailyLog {
  return {
    date,
    energy: 5,
    fog: 5,
    mood: 5,
    sleep: 5,
    flare: false,
    foods: [],
    notes: '',
    timestamp: Date.now(),
  }
}

export const useDailyLogStore = create<DailyLogState>()((set, get) => ({
  logs: [],
  initialized: false,

  initialize: async () => {
    const logs = await db.dailyLogs.orderBy('date').reverse().toArray()
    set({ logs, initialized: true })
  },

  saveLog: async (log: DailyLog) => {
    const toSave = { ...log, timestamp: Date.now() }
    await db.dailyLogs.put(toSave)
    set((state) => {
      const existing = state.logs.findIndex((l) => l.date === log.date)
      if (existing >= 0) {
        const updated = [...state.logs]
        updated[existing] = toSave
        return { logs: updated }
      }
      return { logs: [toSave, ...state.logs].sort((a, b) => b.date.localeCompare(a.date)) }
    })
    syncStateToServer()
  },

  getLogForDate: (date: string) => {
    return get().logs.find((l) => l.date === date)
  },

  getRecentLogs: (days: number) => {
    const today = todayString()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]!
    return get().logs.filter((l) => l.date >= startStr && l.date <= today)
  },

  deleteLog: async (date: string) => {
    await db.dailyLogs.delete(date)
    set((state) => ({ logs: state.logs.filter((l) => l.date !== date) }))
    syncStateToServer()
  },
}))

export { createEmptyLog }
