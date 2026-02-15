import { phases } from '@/data/roadmap'
import { useSettingsStore } from '@/stores/settingsStore'
import { useRoadmapStore, milestones } from '@/stores/roadmapStore'
import { addDays, today, diffDays } from './dateCalc'

export interface CalculatedDates {
  milestoneId: string
  expectedStart: string
  expectedEnd: string
  delayDays: number // positive = delayed, negative = ahead
}

/**
 * Walk the dependency graph forward from the protocol start date.
 * Adjusts dates based on actual completion times.
 */
export function calculateTimelineDates(): CalculatedDates[] {
  const protocolStart = useSettingsStore.getState().protocolStartDate
  const roadmapState = useRoadmapStore.getState()

  const results: CalculatedDates[] = []

  for (const milestone of milestones) {
    const phase = phases.find((p) => p.id === milestone.phaseId)
    if (!phase) continue

    // Default dates from phase offsets
    const defaultStart = addDays(protocolStart, phase.defaultStartOffset)

    // Check if dependencies are met and if they were late/early
    const items = roadmapState.getActionItemsForMilestone(milestone.id)
    const allDeps = items.flatMap((a) => a.dependsOn)
    const uniqueDeps = [...new Set(allDeps)]

    let maxDepCompletionDate: string | null = null
    let hasIncompleteBlockingDeps = false

    for (const depId of uniqueDeps) {
      const depItem = roadmapState.getActionItem(depId)
      if (depItem.blocksDownstream) {
        if (!depItem.completed) {
          hasIncompleteBlockingDeps = true
        } else if (depItem.completedDate) {
          if (!maxDepCompletionDate || depItem.completedDate > maxDepCompletionDate) {
            maxDepCompletionDate = depItem.completedDate
          }
        }
      }
    }

    let actualStart = defaultStart
    let delayDays = 0

    if (hasIncompleteBlockingDeps) {
      // Dependencies not yet met — use today as effective start (it will shift)
      const todayStr = today()
      if (todayStr > defaultStart) {
        actualStart = todayStr
        delayDays = diffDays(defaultStart, todayStr)
      }
    } else if (maxDepCompletionDate && maxDepCompletionDate > defaultStart) {
      // Dependencies completed late — shift start
      actualStart = maxDepCompletionDate
      delayDays = diffDays(defaultStart, maxDepCompletionDate)
    } else if (maxDepCompletionDate && maxDepCompletionDate < defaultStart) {
      // Dependencies completed early — could pull forward
      actualStart = maxDepCompletionDate
      delayDays = diffDays(defaultStart, maxDepCompletionDate) // negative = ahead
    }

    const actualEnd = addDays(actualStart, phase.defaultDuration)

    results.push({
      milestoneId: milestone.id,
      expectedStart: actualStart,
      expectedEnd: actualEnd,
      delayDays,
    })
  }

  return results
}

/**
 * Determines the glow state for a milestone bubble.
 * - No glow: on track
 * - Orange: delayed (1-7 days)
 * - Red: severely delayed (>7 days)
 */
export function getMilestoneGlowState(milestoneId: string): 'none' | 'orange' | 'red' {
  const dates = calculateTimelineDates()
  const milestoneDates = dates.find((d) => d.milestoneId === milestoneId)
  if (!milestoneDates) return 'none'

  const status = useRoadmapStore.getState().getMilestoneStatus(milestoneId)
  if (status === 'completed') return 'none'

  if (milestoneDates.delayDays > 7) return 'red'
  if (milestoneDates.delayDays > 0) return 'orange'

  return 'none'
}
