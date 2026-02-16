import { useRef } from 'react'
import { useRoadmapStore, milestones, phases } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { MilestoneStatus } from '@/types'

interface BubbleProps {
  milestoneId: string
  x: number
  y: number
  radius: number
  progress: number
  onTap: (milestoneId: string) => void
}

function blobPath(cx: number, cy: number, r: number, seed: number, variance: number = 0.15): string {
  const points = 8
  const angleStep = (Math.PI * 2) / points
  const rand = (i: number) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  const pts: [number, number][] = []
  for (let i = 0; i < points; i++) {
    const a = angleStep * i
    const rv = r * (1 + (rand(i) - 0.5) * variance * 2)
    pts.push([cx + Math.cos(a) * rv, cy + Math.sin(a) * rv])
  }
  let d = `M ${pts[0]![0]},${pts[0]![1]}`
  for (let i = 0; i < points; i++) {
    const curr = pts[i]!
    const next = pts[(i + 1) % points]!
    const prev = pts[(i - 1 + points) % points]!
    const nextNext = pts[(i + 2) % points]!
    const cp1x = curr[0] + (next[0] - prev[0]) * 0.25
    const cp1y = curr[1] + (next[1] - prev[1]) * 0.25
    const cp2x = next[0] - (nextNext[0] - curr[0]) * 0.25
    const cp2y = next[1] - (nextNext[1] - curr[1]) * 0.25
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next[0]},${next[1]}`
  }
  d += ' Z'
  return d
}

function mileSeed(id: string): number {
  return id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)
  const isDark = theme === 'dark'

  const status: MilestoneStatus = getMilestoneStatus(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0

  const seedRef = useRef(mileSeed(milestoneId))

  const blob1 = blobPath(0, 0, radius, seedRef.current, 0.12)
  const blob2 = blobPath(0, 0, radius, seedRef.current + 100, 0.14)
  const blob3 = blobPath(0, 0, radius, seedRef.current + 200, 0.10)

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Blob click target with morphing animation */}
      <path
        d={blob1}
        fill="transparent"
      >
        <animate
          attributeName="d"
          values={`${blob1};${blob2};${blob3};${blob1}`}
          dur="12s"
          repeatCount="indefinite"
        />
      </path>

      {/* Label */}
      <text
        x={0}
        y={-6}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={600}
        fill={isDark ? '#FFFFFE' : '#2D2A32'}
        opacity={status === 'blocked' ? 0.4 : 0.9}
      >
        {`Phase ${phaseIndex}`}
      </text>
      <text
        x={0}
        y={10}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={400}
        fill={isDark ? '#FFFFFE' : '#2D2A32'}
        opacity={status === 'blocked' ? 0.3 : 0.6}
      >
        {getShortPhaseName(phaseIndex)}
      </text>
    </g>
  )
}

const shortPhaseNames: Record<number, string> = {
  0: 'Baseline',
  1: 'Interpret',
  2: 'Treatment',
  3: 'Rebuild',
  4: 'Diet Trial',
  5: 'Retest',
  6: 'Optimize',
  7: 'Maintain',
}

function getShortPhaseName(phaseIndex: number): string {
  return shortPhaseNames[phaseIndex] ?? ''
}
