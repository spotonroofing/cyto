import { milestones, phases } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'

interface BubbleProps {
  milestoneId: string
  x: number
  y: number
  radius: number
  progress: number
  onTap: (milestoneId: string) => void
}

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const { palette } = useTheme()

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
      <circle cx={0} cy={0} r={radius} fill="transparent" />

      {/* Phase name — primary label */}
      <text
        x={0} y={-4}
        textAnchor="middle" dominantBaseline="central"
        fontSize={11}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={600}
        fill={palette.text}
        opacity={0.85}
      >
        {getShortPhaseName(phaseIndex)}
      </text>

      {/* Phase number — secondary, smaller */}
      <text
        x={0} y={12}
        textAnchor="middle" dominantBaseline="central"
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={400}
        fill={palette.text}
        opacity={0.45}
        letterSpacing="0.5"
      >
        {`P${phaseIndex}`}
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
