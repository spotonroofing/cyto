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

// TODO: Remove sample data seeding before production
async function seedSampleData(): Promise<void> {
  const today = new Date(todayString() + 'T00:00:00')
  const logs: DailyLog[] = []

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (14 - i))
    const dateStr = d.toISOString().split('T')[0]!

    // Day 6 and Day 13 are unlogged gaps
    if (i === 6 || i === 13) continue

    if (i === 14) {
      // Today: specific values
      logs.push({
        date: dateStr,
        energy: 7,
        mood: 6,
        fog: 4,
        sleep: 7,
        flare: true,
        flareSeverity: 1,
        foods: ['chicken', 'rice'],
        notes: '',
        timestamp: Date.now(),
      })
    } else {
      // Deterministic values seeded by day index
      const seed = i * 17 + 5
      const energy = 5 + (seed % 4)           // 5-8
      const mood = 4 + ((seed * 3) % 4)       // 4-7
      const fog = 3 + ((seed * 7) % 4)        // 3-6
      const sleep = 5 + ((seed * 11) % 4)     // 5-8
      logs.push({
        date: dateStr,
        energy,
        mood,
        fog,
        sleep,
        flare: false,
        foods: [],
        notes: '',
        timestamp: d.getTime(),
      })
    }
  }

  for (const log of logs) {
    await db.dailyLogs.put(log)
  }
}

export const useDailyLogStore = create<DailyLogState>()((set, get) => ({
  logs: [],
  initialized: false,

  initialize: async () => {
    let logs = await db.dailyLogs.orderBy('date').reverse().toArray()
    // TODO: Remove sample data seeding before production
    if (logs.length === 0) {
      await seedSampleData()
      logs = await db.dailyLogs.orderBy('date').reverse().toArray()
    }
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
