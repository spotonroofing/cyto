import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import { DayCell } from './DayCell'

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

/** Get the phase color for a given day offset from protocol start. */
function getPhaseColorForDay(dayOffset: number, isDark: boolean): string {
  for (let i = phases.length - 1; i >= 0; i--) {
    const phase = phases[i]!
    if (dayOffset >= phase.defaultStartOffset) {
      return isDark ? phase.darkColor : phase.color
    }
  }
  return isDark ? phases[0]!.darkColor : phases[0]!.color
}

/** Build list of date strings from protocolStart to today, newest first. */
function buildDateList(protocolStart: string): string[] {
  const today = todayString()
  const start = new Date(protocolStart + 'T00:00:00')
  const end = new Date(today + 'T00:00:00')
  if (start > end) return [today]

  const dates: string[] = []
  const cursor = new Date(end)
  while (cursor >= start) {
    dates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates
}

/** Compute current streak (consecutive logged days ending today or yesterday). */
function computeStreak(dates: string[], getLog: (d: string) => unknown): number {
  let streak = 0
  for (const date of dates) {
    if (getLog(date)) {
      streak++
    } else {
      // Allow today to be unlogged without breaking streak
      if (streak === 0 && date === todayString()) continue
      break
    }
  }
  return streak
}

/** Group dates into streak segments: consecutive logged days form a group. */
interface StreakGroup {
  dates: string[]
  isStreak: boolean // all logged
}

function buildStreakGroups(
  dates: string[],
  getLog: (d: string) => unknown,
): StreakGroup[] {
  if (dates.length === 0) return []

  const groups: StreakGroup[] = []
  let current: StreakGroup = {
    dates: [dates[0]!],
    isStreak: !!getLog(dates[0]!),
  }

  for (let i = 1; i < dates.length; i++) {
    const date = dates[i]!
    const logged = !!getLog(date)
    if (logged === current.isStreak) {
      current.dates.push(date)
    } else {
      groups.push(current)
      current = { dates: [date], isStreak: logged }
    }
  }
  groups.push(current)
  return groups
}

export function CellColonyStrip() {
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const logs = useDailyLogStore((s) => s.logs)
  const openLogForDate = useUIStore((s) => s.openLogForDate)
  const { isDark } = useTheme()

  const [expanded, setExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const today = todayString()

  // Date list and phase colors
  const dates = useMemo(
    () => (protocolStartDate ? buildDateList(protocolStartDate) : [today]),
    [protocolStartDate, today],
  )

  const startDate = useMemo(
    () => new Date((protocolStartDate || today) + 'T00:00:00'),
    [protocolStartDate, today],
  )

  const getPhaseColor = useCallback(
    (date: string) => {
      const d = new Date(date + 'T00:00:00')
      const dayOffset = Math.round(
        (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      return getPhaseColorForDay(Math.max(0, dayOffset), isDark)
    },
    [startDate, isDark],
  )

  // Streak
  const streak = useMemo(
    () => computeStreak(dates, getLogForDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dates, logs],
  )

  // Streak groups for goo merging
  const streakGroups = useMemo(
    () => buildStreakGroups(dates, getLogForDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dates, logs],
  )

  // Current phase color for streak counter
  const currentPhaseColor = getPhaseColor(today)

  // Click outside to collapse
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setSelectedDate(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Touch outside to collapse
  useEffect(() => {
    if (!expanded) return
    const handler = (e: TouchEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setSelectedDate(null)
      }
    }
    document.addEventListener('touchstart', handler)
    return () => document.removeEventListener('touchstart', handler)
  }, [expanded])

  const handleCellClick = useCallback(
    (date: string) => {
      if (!expanded) {
        // First tap: expand and select
        setExpanded(true)
        setSelectedDate(date)
      } else if (selectedDate === date) {
        // Second tap on same cell: open DailyLogPanel
        openLogForDate(date)
        setExpanded(false)
        setSelectedDate(null)
      } else {
        // Tap different cell while expanded
        setSelectedDate(date)
      }
    },
    [expanded, selectedDate, openLogForDate],
  )

  // No protocol start date message
  const noStartDate = !protocolStartDate

  // Day index for a date (0 = oldest, ascending)
  const getDayIndex = useCallback(
    (date: string) => {
      const d = new Date(date + 'T00:00:00')
      return Math.round(
        (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    },
    [startDate],
  )

  return (
    <div
      ref={stripRef}
      className="fixed left-0 top-0 h-dvh z-30 flex flex-col"
      style={{
        width: expanded ? (window.innerWidth < 768 ? 180 : 200) : (window.innerWidth < 768 ? 44 : 48),
        transition: 'width 250ms ease-out',
        backgroundColor: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: '0 16px 16px 0',
      }}
    >
      {/* Streak counter */}
      {streak >= 2 && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-1 colony-streak-pulse"
          style={{ height: 32, minHeight: 32 }}
        >
          <span style={{ fontSize: 11, color: currentPhaseColor, fontWeight: 700 }}>
            {streak}
          </span>
          <svg width={10} height={12} viewBox="0 0 10 12" fill="none">
            <path
              d="M5 0C5 0 1 4 1 7C1 9.2 3 11 5 11C7 11 9 9.2 9 7C9 4 5 0 5 0Z"
              fill={currentPhaseColor}
              opacity={0.8}
            />
          </svg>
        </div>
      )}

      {/* Scrollable day cells */}
      <div
        className="flex-1 overflow-y-auto colony-scroll"
        style={{
          paddingTop: streak < 2 ? 8 : 0,
          paddingBottom: 8,
        }}
      >
        {noStartDate ? (
          <div
            className="flex items-center justify-center h-full px-2"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}
          >
            {expanded
              ? 'Set your protocol start date in Settings to see your full timeline.'
              : ''}
          </div>
        ) : (
          /* SVG filter for goo effect — defined once */
          <>
            <svg width={0} height={0} className="absolute">
              <defs>
                <filter id="colony-goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                    result="goo"
                  />
                  <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                </filter>
              </defs>
            </svg>

            {streakGroups.map((group, gi) => (
              <div
                key={gi}
                style={{
                  filter: group.isStreak && group.dates.length >= 2 ? 'url(#colony-goo)' : undefined,
                }}
              >
                {group.dates.map((date) => (
                  <div
                    key={date}
                    style={{
                      marginBottom:
                        group.isStreak && group.dates.length >= 2 ? 0 : 2,
                    }}
                  >
                    <DayCell
                      dayIndex={getDayIndex(date)}
                      date={date}
                      log={getLogForDate(date)}
                      phaseColor={getPhaseColor(date)}
                      isToday={date === today}
                      isSelected={expanded && selectedDate === date}
                      onClick={() => handleCellClick(date)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
