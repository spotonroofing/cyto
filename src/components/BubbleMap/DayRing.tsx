import { useMemo, useCallback } from 'react'
import { useRoadmapStore, milestones, phases } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/themes'
import type { LayoutBubble } from './useBubbleLayout'

interface DayRingProps {
  bubbles: LayoutBubble[]
}

const RING_OFFSET = 28
const WEEK_THRESHOLD = 35

/** Simple seeded pseudo-random for stable jitter per index. */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Check if a DailyLog has at least one meaningful metric filled. */
function isLogMeaningful(log: { energy: number; mood: number; foods: string[]; notes: string; fog: number; sleep: number; flare: boolean } | undefined): boolean {
  if (!log) return false
  // Default empty log has energy=5, fog=5, mood=5, sleep=5, flare=false, foods=[], notes=''
  // A log is "meaningful" if the user changed anything from defaults or added content
  if (log.foods.length > 0) return true
  if (log.notes.length > 0) return true
  if (log.flare) return true
  // If all sliders are still at default 5, treat as empty
  if (log.energy !== 5 || log.fog !== 5 || log.mood !== 5 || log.sleep !== 5) return true
  return false
}

export function DayRing({ bubbles }: DayRingProps) {
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const getMilestoneStatus = useRoadmapStore((s) => s.getMilestoneStatus)
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const logs = useDailyLogStore((s) => s.logs) // subscribe to log changes
  const toggleLog = useUIStore((s) => s.toggleLog)
  const { phaseColor } = useTheme()

  // Find the active milestone
  const activeMilestone = useMemo(() => {
    // First in_progress
    for (const ms of milestones) {
      if (getMilestoneStatus(ms.id) === 'in_progress') return ms
    }
    // First not_started
    for (const ms of milestones) {
      if (getMilestoneStatus(ms.id) === 'not_started') return ms
    }
    // All completed — show nothing
    return null
  }, [getMilestoneStatus])

  // Find the bubble for the active milestone
  const activeBubble = useMemo(() => {
    if (!activeMilestone) return null
    return bubbles.find((b) => b.milestoneId === activeMilestone.id) ?? null
  }, [activeMilestone, bubbles])

  // Compute phase info
  const phaseInfo = useMemo(() => {
    if (!activeMilestone) return null
    const phase = phases.find((p) => p.id === activeMilestone.phaseId)
    if (!phase) return null
    const phaseIdx = phases.indexOf(phase)
    return { phase, phaseIdx }
  }, [activeMilestone])

  // Compute day data for the ring
  const dayData = useMemo(() => {
    if (!phaseInfo || !protocolStartDate) return null
    const { phase } = phaseInfo
    const duration = phase.defaultDuration
    const startDate = new Date(protocolStartDate)
    startDate.setDate(startDate.getDate() + phase.defaultStartOffset)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]!

    const useWeeks = duration > WEEK_THRESHOLD
    const dotCount = useWeeks ? Math.ceil(duration / 7) : duration

    // Dot base radius
    let dotRadius: number
    if (useWeeks) {
      dotRadius = 7
    } else if (duration <= 14) {
      dotRadius = 5
    } else if (duration <= 30) {
      dotRadius = 4
    } else {
      dotRadius = 3
    }

    const dots: Array<{
      index: number
      status: 'logged' | 'unlogged' | 'future' | 'today'
      /** For week mode: fraction of days logged (0-1) */
      weekFill?: number
    }> = []

    for (let i = 0; i < dotCount; i++) {
      if (useWeeks) {
        // Week grouping mode
        const weekStart = i * 7
        const weekEnd = Math.min((i + 1) * 7, duration)
        let loggedDays = 0
        let hasFuture = false
        let hasToday = false

        for (let d = weekStart; d < weekEnd; d++) {
          const date = new Date(startDate)
          date.setDate(date.getDate() + d)
          const dateStr = date.toISOString().split('T')[0]!
          const isToday = dateStr === todayStr
          const isFuture = date > today

          if (isFuture) {
            hasFuture = true
          } else if (isToday) {
            hasToday = true
            if (isLogMeaningful(getLogForDate(dateStr))) loggedDays++
          } else {
            if (isLogMeaningful(getLogForDate(dateStr))) loggedDays++
          }
        }

        const daysInWeek = weekEnd - weekStart
        const weekFill = loggedDays / daysInWeek
        let status: 'logged' | 'unlogged' | 'future' | 'today'
        if (hasFuture && loggedDays === 0 && !hasToday) {
          status = 'future'
        } else if (hasToday && loggedDays === 0) {
          status = 'today'
        } else if (loggedDays > 0) {
          status = 'logged'
        } else {
          status = 'unlogged'
        }

        dots.push({ index: i, status, weekFill })
      } else {
        // Day mode
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]!
        const isToday = dateStr === todayStr
        const isFuture = date > today
        const isLogged = isLogMeaningful(getLogForDate(dateStr))

        let status: 'logged' | 'unlogged' | 'future' | 'today'
        if (isLogged) {
          status = 'logged'
        } else if (isToday) {
          status = 'today'
        } else if (isFuture) {
          status = 'future'
        } else {
          status = 'unlogged'
        }

        dots.push({ index: i, status })
      }
    }

    return { dots, dotCount, dotRadius, useWeeks }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseInfo, protocolStartDate, getLogForDate, logs])

  const handleRingTap = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      toggleLog()
    },
    [toggleLog],
  )

  // Don't render if no active milestone, no bubble, or no protocol start date
  if (!activeMilestone || !activeBubble || !phaseInfo || !dayData || !protocolStartDate) {
    return null
  }

  const { x, y, radius } = activeBubble
  const ringRadius = radius + RING_OFFSET
  const { dots, dotCount, dotRadius, useWeeks } = dayData
  const color = phaseColor(phaseInfo.phaseIdx)
  const filterId = 'day-ring-glow'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Filter definition for glow */}
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feFlood floodColor={color} floodOpacity="0.6" result="glowColor" />
          <feComposite in="glowColor" in2="blur" operator="in" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Invisible hit target ring */}
      <circle
        cx={0}
        cy={0}
        r={ringRadius}
        fill="none"
        stroke="transparent"
        strokeWidth={dotRadius * 2 + 20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={handleRingTap}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {/* Dots */}
      {dots.map((dot) => {
        const angle = (dot.index / dotCount) * Math.PI * 2 - Math.PI / 2
        // Jitter
        const radialJitter = (seededRand(dot.index * 3 + 7) - 0.5) * 6 // +/-3px
        const angularJitter = ((seededRand(dot.index * 5 + 13) - 0.5) * 4 * Math.PI) / 180 // +/-2deg
        const finalAngle = angle + angularJitter
        const finalRadius = ringRadius + radialJitter
        const cx = Math.cos(finalAngle) * finalRadius
        const cy = Math.sin(finalAngle) * finalRadius

        if (dot.status === 'logged') {
          return (
            <circle
              key={dot.index}
              cx={cx}
              cy={cy}
              r={dotRadius}
              fill={color}
              filter={`url(#${filterId})`}
              opacity={useWeeks && dot.weekFill !== undefined ? Math.max(0.4, dot.weekFill) : 1}
              className="day-ring-dot-pulse"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animationDelay: `${dot.index * 0.15}s`,
              }}
            />
          )
        }

        if (dot.status === 'today') {
          return (
            <circle
              key={dot.index}
              cx={cx}
              cy={cy}
              r={dotRadius}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              opacity={0.7}
              className="day-ring-dot-breathe"
            />
          )
        }

        if (dot.status === 'future') {
          return (
            <circle
              key={dot.index}
              cx={cx}
              cy={cy}
              r={dotRadius}
              fill="none"
              stroke={color}
              strokeWidth={0.8}
              strokeDasharray="2 2"
              opacity={0.12}
            />
          )
        }

        // unlogged (past)
        return (
          <circle
            key={dot.index}
            cx={cx}
            cy={cy}
            r={dotRadius}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.3}
          />
        )
      })}
    </g>
  )
}
