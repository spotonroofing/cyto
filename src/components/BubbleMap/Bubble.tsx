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

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)
  const isDark = theme === 'dark'

  const status: MilestoneStatus = getMilestoneStatus(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Invisible click target */}
      <circle cx={0} cy={0} r={radius} fill="transparent" />

      {/* Labels */}
      <text
        x={0} y={-6}
        textAnchor="middle" dominantBaseline="central"
        fontSize={12}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={600}
        fill={isDark ? '#FFFFFE' : '#2D2A32'}
        opacity={status === 'blocked' ? 0.4 : 0.9}
      >
        {`Phase ${phaseIndex}`}
      </text>
      <text
        x={0} y={10}
        textAnchor="middle" dominantBaseline="central"
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
  0: 'Baseline', 1: 'Interpret', 2: 'Treatment', 3: 'Rebuild',
  4: 'Diet Trial', 5: 'Retest', 6: 'Optimize', 7: 'Maintain',
}

function getShortPhaseName(i: number): string {
  return shortPhaseNames[i] ?? ''
}
