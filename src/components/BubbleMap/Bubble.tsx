import { motion } from 'framer-motion'
import { useRef } from 'react'
import { useRoadmapStore, milestones, phases } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import { getMilestoneGlowState } from '@/utils/dependencyGraph'
import type { MilestoneStatus } from '@/types'

interface BubbleProps {
  milestoneId: string
  x: number
  y: number
  radius: number
  progress: number
  onTap: (milestoneId: string) => void
}

export function Bubble({ milestoneId, x, y, radius, progress, onTap }: BubbleProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)
  const isDark = theme === 'dark'

  const status: MilestoneStatus = getMilestoneStatus(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0

  const color = getPhaseColor(phaseIndex, isDark)
  const doneColor = isDark ? '#4A8B7F' : '#B5C4B1'

  // Randomized idle animation offsets
  const idleRef = useRef({
    xAmplitude: 0.5 + Math.random() * 1.5,
    yAmplitude: 0.5 + Math.random() * 1.5,
    period: 3 + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
  })

  const idle = idleRef.current
  const scale = status === 'completed' ? 0.9 : 1

  // Progress ring
  const circumference = 2 * Math.PI * (radius + 4)
  const progressOffset = circumference - (progress / 100) * circumference

  // Glow for overdue milestones
  const glowState = getMilestoneGlowState(milestoneId)

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
      style={{ cursor: 'pointer' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Transparent click target (the filled circle is in the goo group) */}
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill="transparent"
      />

      {/* Glow ring for overdue milestones */}
      {glowState && (
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill="none"
          stroke={glowState === 'red' ? '#FF4444' : '#FF8C00'}
          strokeWidth={4}
          strokeOpacity={0.4}
          filter={`url(#glow-${glowState})`}
        />
      )}

      {/* Progress ring — animated */}
      {progress > 0 && progress < 100 && (
        <motion.circle
          cx={0}
          cy={0}
          r={radius + 4}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progressOffset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.5 }}
          transform="rotate(-90)"
          opacity={0.8}
        />
      )}

      {/* Completed ring */}
      {progress === 100 && (
        <circle
          cx={0}
          cy={0}
          r={radius + 4}
          fill="none"
          stroke={doneColor}
          strokeWidth={3}
          opacity={0.6}
        />
      )}

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
