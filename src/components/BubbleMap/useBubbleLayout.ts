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

export interface RowBand {
  yStart: number  // world-space Y top of this row
  yEnd: number    // world-space Y bottom of this row
  contentWidth: number  // total content width (for auto-zoom)
  isFork: boolean       // true if 2+ bubbles side-by-side
}

// Deterministic vertical layout: each milestone has a fixed row and branch assignment.
// row: 0 (top) to 6 (bottom) — path flows downward
// branch: 'main' = center column, 'left'/'right' = fork offset (side-by-side horizontally)
const milestoneLayout: Record<string, { row: number; branch: 'main' | 'left' | 'right' }> = {
  'ms-diagnostic-baseline': { row: 0, branch: 'main' },
  'ms-interpret-results': { row: 1, branch: 'main' },
  'ms-antibiotic-protocol': { row: 2, branch: 'main' },
  'ms-rebuild-gut': { row: 3, branch: 'left' },
  'ms-confirm-progress': { row: 3.5, branch: 'right' },
  'ms-diet-expansion': { row: 4, branch: 'left' },
  'ms-expand-strengthen': { row: 5, branch: 'main' },
  'ms-sustained-recovery': { row: 6, branch: 'main' },
}

const ROW_SPACING = 280

export function useBubbleLayout(width: number, height: number) {
  const [bubbles, setBubbles] = useState<LayoutBubble[]>([])
  const [links, setLinks] = useState<LayoutLink[]>([])
  const [rowBands, setRowBands] = useState<RowBand[]>([])
  const [settled, setSettled] = useState(false)
  const initialSettleRef = useRef(false)

  const getMilestoneProgress = useRoadmapStore((s) => s.getMilestoneProgress)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)

  useEffect(() => {
    if (width === 0 || height === 0) return

    const paddingY = ROW_SPACING * 0.5
    const centerX = width / 2
    const waveAmplitude = Math.min(width * 0.06, 40)
    const branchOffset = Math.min(width * 0.30, 160)

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
        positionMap.set(ms.id, { x: centerX, y: 0, radius, phaseIndex })
        return { milestoneId: ms.id, phaseId: ms.phaseId, phaseIndex, x: centerX, y: 0, radius, progress: progress.percentage, status: getMilestoneStatus(ms.id) }
      }

      // Y: deterministic vertical position (top to bottom)
      const y = paddingY + layout.row * ROW_SPACING

      // X: sine wave for organic horizontal offset + branch split
      let x = centerX + Math.sin(layout.row * 0.8) * waveAmplitude
      if (layout.branch === 'left') x -= branchOffset
      if (layout.branch === 'right') x += branchOffset

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

    // Compute per-row info for auto-zoom: which Y ranges have forks
    const rowBubbles = new Map<number, { minX: number; maxX: number; y: number }>()
    for (const b of computedBubbles) {
      const layout = milestoneLayout[b.milestoneId]
      if (!layout) continue
      const rowKey = Math.floor(layout.row) // group 3 and 3.5 into row 3
      const existing = rowBubbles.get(rowKey)
      if (existing) {
        existing.minX = Math.min(existing.minX, b.x - b.radius)
        existing.maxX = Math.max(existing.maxX, b.x + b.radius)
        existing.y = Math.min(existing.y, b.y) // topmost in this row group
      } else {
        rowBubbles.set(rowKey, { minX: b.x - b.radius, maxX: b.x + b.radius, y: b.y })
      }
    }

    // Build row bands: for each row, the Y range and required width
    const computedRowBands: RowBand[] = []
    for (const [_rowKey, info] of rowBubbles) {
      // Find all bubbles in this row group to get full Y extent
      const rowMs = computedBubbles.filter(b => {
        const l = milestoneLayout[b.milestoneId]
        return l && Math.floor(l.row) === _rowKey
      })
      const minY = Math.min(...rowMs.map(b => b.y - b.radius))
      const maxY = Math.max(...rowMs.map(b => b.y + b.radius))
      computedRowBands.push({
        yStart: minY,
        yEnd: maxY,
        contentWidth: info.maxX - info.minX,
        isFork: rowMs.length > 1,
      })
    }

    setBubbles(computedBubbles)
    setLinks(computedLinks)
    setRowBands(computedRowBands)

    // Signal settled after entrance animations complete (first time only)
    if (!initialSettleRef.current) {
      const timer = window.setTimeout(() => {
        setSettled(true)
        initialSettleRef.current = true
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [width, height, getMilestoneProgress, getMilestoneStatus])

  return { bubbles, links, settled, rowBands }
}
