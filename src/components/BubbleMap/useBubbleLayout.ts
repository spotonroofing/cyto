import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { milestones, phases } from '@/stores/roadmapStore'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { milestoneDependencies } from '@/data/dependencies'
import type { BubblePosition } from '@/types'

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string
  milestoneId: string
  phaseId: string
  phaseIndex: number
  radius: number
  progress: number
}

interface BubbleLink extends d3.SimulationLinkDatum<BubbleNode> {
  sourceId: string
  targetId: string
}

export interface LayoutBubble {
  milestoneId: string
  phaseId: string
  phaseIndex: number
  x: number
  y: number
  radius: number
  progress: number
}

export function useBubbleLayout(width: number, height: number) {
  const [bubbles, setBubbles] = useState<LayoutBubble[]>([])
  const [links, setLinks] = useState<{ source: BubblePosition; target: BubblePosition }[]>([])
  const simulationRef = useRef<d3.Simulation<BubbleNode, BubbleLink> | null>(null)

  const getMilestoneProgress = useRoadmapStore((s) => s.getMilestoneProgress)

  const buildLayout = useCallback(() => {
    if (width === 0 || height === 0) return

    // Build nodes
    const nodes: BubbleNode[] = milestones.map((ms) => {
      const phase = phases.find((p) => p.id === ms.phaseId)
      const phaseIndex = phases.indexOf(phase!)
      const progress = getMilestoneProgress(ms.id)
      // Radius based on number of action items (min 35, max 70)
      const itemCount = ms.actionItemIds.length
      const radius = Math.max(35, Math.min(70, 25 + itemCount * 3))

      return {
        id: ms.id,
        milestoneId: ms.id,
        phaseId: ms.phaseId,
        phaseIndex,
        radius,
        progress: progress.percentage,
        // Start positions spread by phase
        x: width / 2 + (phaseIndex - 3.5) * (width / 10),
        y: height / 2 + (Math.random() - 0.5) * 100,
      }
    })

    // Build links from dependencies
    const linkData: BubbleLink[] = []
    for (const [sourceId, targets] of Object.entries(milestoneDependencies)) {
      for (const targetId of targets) {
        linkData.push({
          sourceId,
          targetId,
          source: sourceId,
          target: targetId,
        })
      }
    }

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const simulation = d3
      .forceSimulation<BubbleNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<BubbleNode, BubbleLink>(linkData)
          .id((d) => d.id)
          .distance(150)
          .strength(0.3),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<BubbleNode>().radius((d) => d.radius + 15),
      )
      // Push nodes along x-axis by phase order (chronological flow)
      .force(
        'x',
        d3
          .forceX<BubbleNode>()
          .x((d) => {
            const xSpread = width * 0.75
            const xStart = width * 0.125
            return xStart + (d.phaseIndex / 7) * xSpread
          })
          .strength(0.15),
      )
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.02)

    simulation.on('tick', () => {
      const updatedBubbles: LayoutBubble[] = nodes.map((node) => ({
        milestoneId: node.milestoneId,
        phaseId: node.phaseId,
        phaseIndex: node.phaseIndex,
        x: node.x ?? 0,
        y: node.y ?? 0,
        radius: node.radius,
        progress: node.progress,
      }))

      const updatedLinks = linkData.map((link) => {
        const sourceNode = typeof link.source === 'object' ? link.source : nodes.find((n) => n.id === link.source)
        const targetNode = typeof link.target === 'object' ? link.target : nodes.find((n) => n.id === link.target)
        return {
          source: { x: sourceNode?.x ?? 0, y: sourceNode?.y ?? 0, radius: sourceNode?.radius ?? 35 },
          target: { x: targetNode?.x ?? 0, y: targetNode?.y ?? 0, radius: targetNode?.radius ?? 35 },
        }
      })

      setBubbles(updatedBubbles)
      setLinks(updatedLinks)
    })

    simulationRef.current = simulation

    // Let simulation settle
    simulation.alpha(1).restart()
  }, [width, height, getMilestoneProgress])

  useEffect(() => {
    buildLayout()
    return () => {
      simulationRef.current?.stop()
    }
  }, [buildLayout])

  return { bubbles, links }
}
