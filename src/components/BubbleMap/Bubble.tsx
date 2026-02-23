import { milestones, phases } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'
import { useTuningStore } from '@/stores/tuningStore'
import {
  Microscope, FileSearch, Pill, HeartPulse,
  Utensils, FlaskConical, Sparkles, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const phaseIcons: Record<number, LucideIcon> = {
  0: Microscope, 1: FileSearch, 2: Pill, 3: HeartPulse,
  4: Utensils, 5: FlaskConical, 6: Sparkles, 7: ShieldCheck,
}

const ICON_LABEL_GAP = 7

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
  const iconSizeRatio = useTuningStore((s) => s.iconSizeRatio)
  const phaseNameFontSize = useTuningStore((s) => s.phaseNameFontSize)
  const phaseIndicatorFontSize = useTuningStore((s) => s.phaseIndicatorFontSize)

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
      {/* Hit target */}
      <circle cx={0} cy={0} r={radius} fill="transparent" />

      {/* Phase icon */}
      {(() => {
        const Icon = phaseIcons[phaseIndex]
        if (!Icon) return null
        const size = Math.round(radius * iconSizeRatio)
        return (
          <g transform={`translate(${-size / 2} ${-size / 2 - 12 - ICON_LABEL_GAP})`}>
            <Icon
              width={size} height={size}
              color={palette.text}
              opacity={0.7}
              strokeWidth={2}
              style={{ pointerEvents: 'none', width: size, height: size, overflow: 'hidden' }}
            />
          </g>
        )
      })()}

      {/* Phase name */}
      <text
        x={0} y={5}
        textAnchor="middle" dominantBaseline="central"
        fontSize={phaseNameFontSize}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={600}
        fill={palette.text}
        opacity={0.85}
      >
        {getShortPhaseName(phaseIndex)}
      </text>

      {/* Phase number */}
      <text
        x={0} y={21}
        textAnchor="middle" dominantBaseline="central"
        fontSize={phaseIndicatorFontSize}
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
