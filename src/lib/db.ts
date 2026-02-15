import Dexie, { type EntityTable } from 'dexie'
import type { DailyLog, ChatMessage } from '@/types'

// Stored roadmap state — tracks completion separately from default data
export interface StoredActionItemState {
  id: string
  completed: boolean
  completedDate?: string
  notes?: string
  foodTrialOutcome?: 'pass' | 'fail'
}

export interface StoredMilestoneNote {
  id: string
  milestoneId: string
  content: string
  timestamp: number
}

const db = new Dexie('cytoDB') as Dexie & {
  dailyLogs: EntityTable<DailyLog, 'date'>
  chatMessages: EntityTable<ChatMessage, 'id'>
  actionItemStates: EntityTable<StoredActionItemState, 'id'>
  milestoneNotes: EntityTable<StoredMilestoneNote, 'id'>
}

db.version(1).stores({
  dailyLogs: 'date, timestamp',
  chatMessages: 'id, timestamp, milestoneContext',
  actionItemStates: 'id',
  milestoneNotes: 'id, milestoneId, timestamp',
})

export { db }
