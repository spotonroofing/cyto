// === Roadmap Data Model (Spec Section 10.1) ===

export interface Phase {
  id: string
  name: string
  color: string
  darkColor: string
  defaultStartOffset: number // days after protocol start
  defaultDuration: number // days
}

export interface ActionItem {
  id: string
  phaseId: string
  milestoneId: string
  title: string
  description?: string
  completed: boolean
  completedDate?: string // ISO date
  dueDate?: string // ISO date (calculated)
  blocksDownstream: boolean
  dependsOn: string[] // IDs of items that must complete first
  category: 'test' | 'medication' | 'supplement' | 'diet' | 'lifestyle' | 'peptide' | 'consultation'
  // For food reintroduction items (Phase 4)
  foodTrial?: {
    food: string
    tier: number
    outcome?: 'pass' | 'fail'
  }
}

export interface Milestone {
  id: string
  phaseId: string
  title: string
  description: string
  actionItemIds: string[]
  expectedStartDate?: string // calculated
  expectedEndDate?: string // calculated
}

// === Daily Log Data Model (Spec Section 10.2) ===

export interface DailyLog {
  date: string // YYYY-MM-DD
  energy: number // 1-10
  fog: number // 1-10
  mood: number // 1-10
  sleep: number // 1-10
  flare: boolean
  flareSeverity?: number // 1-5
  flareTrigger?: string
  weight?: number // lbs
  foods: string[]
  notes: string
  timestamp: number // when log was created/updated
}

// === Chat Data Model (Spec Section 10.3) ===

export type RoadmapActionType = 'add_item' | 'remove_item' | 'complete_item' | 'update_date' | 'add_note'

export interface RoadmapAction {
  action: RoadmapActionType
  target: string // item ID
  data: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  milestoneContext?: string // which milestone was open when sent
  actions?: RoadmapAction[]
}

// === UI State ===

export type ViewState = 'map' | 'milestone' | 'log' | 'analytics' | 'chat' | 'settings'

export interface BubblePosition {
  x: number
  y: number
  radius: number
}

// === Milestone Status (derived) ===

export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'blocked'
