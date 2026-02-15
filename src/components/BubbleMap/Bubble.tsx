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

  // Bubble appearance based on status
  const opacity = status === 'not_started' ? 0.6 : status === 'blocked' ? 0.4 : 1
  const fillColor = status === 'completed' ? doneColor : color
  const scale = status === 'completed' ? 0.9 : 1

  // Progress ring
  const circumference = 2 * Math.PI * (radius + 4)
  const progressOffset = circumference - (progress / 100) * circumference

  // Glow for overdue milestones (Phase 11: Timeline Intelligence)
  const glowState = getMilestoneGlowState(milestoneId)
  const glowFilter = glowState === 'red' ? 'url(#glow-red)' : glowState === 'orange' ? 'url(#glow-orange)' : undefined

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
      {/* Main bubble */}
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={fillColor}
        fillOpacity={opacity}
        stroke={fillColor}
        strokeWidth={2}
        strokeOpacity={0.5}
        filter={glowFilter}
      />

      {/* Progress ring */}
      {progress > 0 && progress < 100 && (
        <circle
          cx={0}
          cy={0}
          r={radius + 4}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
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

      {/* Blocked overlay icon */}
      {status === 'blocked' && (
        <text
          x={0}
          y={-radius + 14}
          textAnchor="middle"
          fontSize={12}
          fill={isDark ? '#FFFFFE' : '#2D2A32'}
          opacity={0.5}
        >
          🔒
        </text>
      )}

      {/* Label */}
      <text
        x={0}
        y={status === 'blocked' ? 4 : 0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={radius > 50 ? 11 : 10}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={500}
        fill={isDark ? '#FFFFFE' : '#2D2A32'}
        opacity={0.9}
      >
        {truncateLabel(milestone?.title ?? '', radius)}
      </text>

      {/* Phase label (small) */}
      <text
        x={0}
        y={14}
        textAnchor="middle"
        fontSize={8}
        fontFamily="'Inter', sans-serif"
        fill={isDark ? '#FFFFFE' : '#2D2A32'}
        opacity={0.5}
      >
        Phase {phaseIndex}
      </text>
    </motion.g>
  )
}

function truncateLabel(text: string, radius: number): string {
  const maxChars = Math.floor(radius / 4.5)
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}
