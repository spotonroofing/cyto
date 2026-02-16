import { motion } from 'framer-motion'
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

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)
  const isDark = theme === 'dark'

  const status: MilestoneStatus = getMilestoneStatus(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0

  const scale = status === 'completed' ? 0.9 : 1

  // Randomized idle animation offsets
  const idleRef = useRef({
    xAmplitude: 0.3 + Math.random() * 0.7,
    yAmplitude: 0.3 + Math.random() * 0.7,
    period: 5 + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
  })

  const idle = idleRef.current

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale,
        opacity: 1,
        x: [x - idle.xAmplitude, x + idle.xAmplitude, x - idle.xAmplitude],
        y: [y - idle.yAmplitude, y + idle.yAmplitude, y - idle.yAmplitude],
      }}
      transition={{
        scale: { type: 'spring', stiffness: 150, damping: 20 },
        opacity: { duration: 0.4 },
        x: {
          duration: idle.period,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        y: {
          duration: idle.period * 1.1,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: idle.phase,
        },
      }}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Transparent click target (the filled circle is in the main group) */}
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill="transparent"
      />

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

    </motion.g>
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
