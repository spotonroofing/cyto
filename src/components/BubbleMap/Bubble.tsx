import { milestones, phases } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'
import {
  Microscope, FileSearch, Pill, HeartPulse,
  Utensils, FlaskConical, Sparkles, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const phaseIcons: Record<number, LucideIcon> = {
  0: Microscope, 1: FileSearch, 2: Pill, 3: HeartPulse,
  4: Utensils, 5: FlaskConical, 6: Sparkles, 7: ShieldCheck,
}

interface BubbleProps {
  milestoneId: string
  x: number
  y: number
  radius: number
  progress: number
  onTap: (milestoneId: string) => void
}

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const { palette, phaseColor } = useTheme()

  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0
  const color = phaseColor(phaseIndex)

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Border ring drawn in GooCanvas — follows organic membrane contour */}
      {/* Nucleus — dense core inside the membrane */}
      <circle cx={0} cy={0} r={radius * 0.57} fill={color} opacity={0.7} />
      {/* Hit target */}
      <circle cx={0} cy={0} r={radius} fill="transparent" />

      {/* Phase icon */}
      {(() => {
        const Icon = phaseIcons[phaseIndex]
        if (!Icon) return null
        const size = Math.round(radius * 0.28)
        return (
          <foreignObject
            x={-size / 2} y={-size / 2 - 12}
            width={size} height={size}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <Icon
              width={size} height={size}
              color={palette.text}
              opacity={0.7}
              strokeWidth={2}
            />
          </foreignObject>
        )
      })()}

      {/* Phase name — primary label */}
      <text
        x={0} y={5}
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
        x={0} y={18}
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
