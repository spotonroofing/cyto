/**
 * Pushes app state to the server for OpenClaw consumption.
 * Debounced to avoid hammering the server on rapid changes.
 */

import { useRoadmapStore, milestones } from '@/stores/roadmapStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'

const SYNC_URL = '/api/state'
const DEBOUNCE_MS = 2000

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function buildStateSnapshot() {
  const roadmap = useRoadmapStore.getState()
  const logs = useDailyLogStore.getState()

  const milestoneSnapshots = milestones.map((m) => {
    const progress = roadmap.getMilestoneProgress(m.id)
    const status = roadmap.getMilestoneStatus(m.id)
    return {
      id: m.id,
      title: m.title,
      phaseId: m.phaseId,
      status,
      progress,
    }
  })

  const overallProgress = roadmap.getOverallProgress()
  const currentMilestone = roadmap.getCurrentMilestone()

  const recentLogs = logs.getRecentLogs(7).map((l) => ({
    date: l.date,
    energy: l.energy,
    fog: l.fog,
    mood: l.mood,
    sleep: l.sleep,
    flare: l.flare,
    foods: l.foods,
    notes: l.notes,
  }))

  return {
    updatedAt: new Date().toISOString(),
    currentPhase: currentMilestone?.phaseId ?? 'unknown',
    overallProgress,
    milestones: milestoneSnapshots,
    recentLogs,
  }
}

async function pushState() {
  try {
    const snapshot = buildStateSnapshot()
    await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
  } catch {
    // Silent fail — server may not be running in dev mode
  }
}

/**
 * Call this after any meaningful state change (item toggle, log save, etc.).
 * Debounced so rapid changes only trigger one sync.
 */
export function syncStateToServer() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(pushState, DEBOUNCE_MS)
}
