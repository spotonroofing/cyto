import { useEffect, useRef, useState } from 'react'
import { milestones, phases } from '@/stores/roadmapStore'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { milestoneDependencies } from '@/data/dependencies'
import type { MilestoneStatus } from '@/types'

export interface LayoutBubble {
  milestoneId: string
  phaseId: string
  phaseIndex: number
  x: number
  y: number
  radius: number
  progress: number
  status: MilestoneStatus
}

export interface LayoutLink {
  source: { x: number; y: number; radius: number; milestoneId: string }
  target: { x: number; y: number; radius: number; milestoneId: string }
  sourceStatus: MilestoneStatus
  targetStatus: MilestoneStatus
  sourcePhaseIndex: number
  targetPhaseIndex: number
}

// Deterministic layout: each milestone has a fixed horizontal order and branch assignment.
// order: 0 (far left) to 6 (far right)
// branch: 'main' = center path, 'upper'/'lower' = fork offset
const milestoneLayout: Record<string, { order: number; branch: 'main' | 'upper' | 'lower' }> = {
  'ms-diagnostic-baseline': { order: 0, branch: 'main' },
  'ms-interpret-results': { order: 1, branch: 'main' },
  'ms-antibiotic-protocol': { order: 2, branch: 'main' },
  'ms-rebuild-gut': { order: 3, branch: 'upper' },
  'ms-confirm-progress': { order: 3.5, branch: 'lower' },
  'ms-diet-expansion': { order: 4, branch: 'upper' },
  'ms-expand-strengthen': { order: 5, branch: 'main' },
  'ms-sustained-recovery': { order: 6, branch: 'main' },
}

const SPACING = 280

export function useBubbleLayout(width: number, height: number) {
  const [bubbles, setBubbles] = useState<LayoutBubble[]>([])
  const [links, setLinks] = useState<LayoutLink[]>([])
  const [settled, setSettled] = useState(false)
  const initialSettleRef = useRef(false)

  const getMilestoneProgress = useRoadmapStore((s) => s.getMilestoneProgress)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)

  useEffect(() => {
    if (width === 0 || height === 0) return

    const paddingX = SPACING * 0.5
    const centerY = height / 2
    const waveAmplitude = Math.min(height * 0.08, 60)
    const branchOffset = Math.min(height * 0.12, 90)

    // Build bubbles with deterministic positions
    const positionMap = new Map<string, { x: number; y: number; radius: number; phaseIndex: number }>()

    const computedBubbles: LayoutBubble[] = milestones.map((ms) => {
      const phase = phases.find((p) => p.id === ms.phaseId)
      const phaseIndex = phases.indexOf(phase!)
      const progress = getMilestoneProgress(ms.id)
      const itemCount = ms.actionItemIds.length
      const radius = Math.max(62, Math.min(110, 41 + itemCount * 6))

      const layout = milestoneLayout[ms.id]
      if (!layout) {
        positionMap.set(ms.id, { x: 0, y: centerY, radius, phaseIndex })
        return { milestoneId: ms.id, phaseId: ms.phaseId, phaseIndex, x: 0, y: centerY, radius, progress: progress.percentage, status: getMilestoneStatus(ms.id) }
      }

      // X: deterministic horizontal position
      const x = paddingX + layout.order * SPACING

      // Y: sine wave for organic vertical offset + branch split
      let y = centerY + Math.sin(layout.order * 0.8) * waveAmplitude
      if (layout.branch === 'upper') y -= branchOffset
      if (layout.branch === 'lower') y += branchOffset

      positionMap.set(ms.id, { x, y, radius, phaseIndex })

      return {
        milestoneId: ms.id,
        phaseId: ms.phaseId,
        phaseIndex,
        x,
        y,
        radius,
        progress: progress.percentage,
        status: getMilestoneStatus(ms.id),
      }
    })

    // Build links from dependency graph
    const computedLinks: LayoutLink[] = []
    for (const [sourceId, targets] of Object.entries(milestoneDependencies)) {
      for (const targetId of targets) {
        const sourcePos = positionMap.get(sourceId)
        const targetPos = positionMap.get(targetId)
        if (!sourcePos || !targetPos) continue

        computedLinks.push({
          source: {
            x: sourcePos.x,
            y: sourcePos.y,
            radius: sourcePos.radius,
            milestoneId: sourceId,
          },
          target: {
            x: targetPos.x,
            y: targetPos.y,
            radius: targetPos.radius,
            milestoneId: targetId,
          },
          sourceStatus: getMilestoneStatus(sourceId),
          targetStatus: getMilestoneStatus(targetId),
          sourcePhaseIndex: sourcePos.phaseIndex,
          targetPhaseIndex: targetPos.phaseIndex,
        })
      }
    }

    setBubbles(computedBubbles)
    setLinks(computedLinks)

    // Signal settled after entrance animations complete (first time only)
    if (!initialSettleRef.current) {
      const timer = window.setTimeout(() => {
        setSettled(true)
        initialSettleRef.current = true
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [width, height, getMilestoneProgress, getMilestoneStatus])

  return { bubbles, links, settled }
}
