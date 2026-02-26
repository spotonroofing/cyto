import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

// ── Layout constants ──────────────────────────────────────────────────────
const COLLAPSED_WIDTH = 32 // CHANGE 6: was 24
const EXPANDED_WIDTH_MOBILE = 240
const EXPANDED_WIDTH_DESKTOP = 260
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 7
const DOT_COL_WIDTH = 32 // CHANGE 6: was 24
const DOT_X_OFFSET = 16 // CHANGE 6: was 12
const STATS_HEIGHT = 44

// ── Progress ring constants ───────────────────────────────────────────────
const RING_SIZE = 32
const RING_STROKE = 2.5
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_RADIUS

const METRIC_COLORS: Record<string, string> = {
  E: '#F5A623',
  M: '#7ED688',
  B: '#6CB4EE',
  F: '#6CB4EE',
  S: '#B39DDB',
}

const TRANSITION_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

// ── Helpers ───────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

function getPhaseIndex(dayOffset: number): number {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (dayOffset >= phases[i]!.defaultStartOffset) return i
  }
  return 0
}

function getPhaseDarkColor(dayOffset: number): string {
  const idx = getPhaseIndex(dayOffset)
  return phases[idx]?.darkColor ?? phases[0]!.darkColor
}

function getPhaseColorFromPalette(
  dayOffset: number,
  phaseColors: string[],
): string {
  const idx = getPhaseIndex(dayOffset)
  return phaseColors[idx] ?? phaseColors[0]!
}

function isLogged(log: DailyLog | undefined): boolean {
  if (!log) return false
  return (
    log.energy > 0 ||
    log.mood > 0 ||
    log.fog > 0 ||
    log.sleep > 0 ||
    log.flare === true ||
    log.foods.length > 0
  )
}

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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Day quality bar: average with inverted fog, hue 0 (red) at avg=0 to 120 (green) at avg=10
function dayQualityColor(energy: number, mood: number, fog: number, sleep: number): string {
  const avg = (energy + mood + (10 - fog) + sleep) / 4
  const clamped = Math.max(0, Math.min(10, avg))
  const hue = (clamped / 10) * 120
  return `hsl(${hue}, 70%, 55%)`
}

// CHANGE 8a: Day-of-week abbreviation
function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

// ── ProgressRing ──────────────────────────────────────────────────────────

function ProgressRing({
  letter,
  value,
  logged,
}: {
  letter: string
  value: number
  logged: boolean
}) {
  // Fixed metric color per ring
  const color = logged ? (METRIC_COLORS[letter] ?? 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.08)'
  const fraction = logged ? Math.min(value / 10, 1) : 0
  const offset = RING_CIRC * (1 - fraction)

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}
    >
      {/* Background track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={RING_STROKE}
      />
      {/* Foreground arc */}
      {logged && (
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      )}
      {/* Center letter */}
      <text
        x={RING_SIZE / 2}
        y={RING_SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="500"
        fill={logged ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)'}
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
      >
        {letter}
      </text>
    </svg>
  )
}

// ── FlareIndicator ────────────────────────────────────────────────────────

function FlareIndicator({ severity }: { severity: number }) {
  const dotCount = Math.min(severity, 3)
  const showPlus = severity > 3
  const dotSize = 5
  const gap = 3

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap,
      }}
    >
      {Array.from({ length: dotCount }, (_, i) => (
        <span
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: '#FF6B4A',
            display: 'block',
            flexShrink: 0,
          }}
        />
      ))}
      {showPlus && (
        <span
          style={{
            fontSize: 7,
            color: '#FF6B4A',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          +
        </span>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function CellColonyStrip() {
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const logs = useDailyLogStore((s) => s.logs)
  const openLogForDate = useUIStore((s) => s.openLogForDate)
  const { phaseColor: themePhaseColor } = useTheme()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(COLLAPSED_WIDTH)
  const [contentVisible, setContentVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const today = todayString()

  const phaseColors = useMemo(
    () => Array.from({ length: 8 }, (_, i) => themePhaseColor(i)),
    [themePhaseColor],
  )

  const dates = useMemo(
    () => (protocolStartDate ? buildDateList(protocolStartDate) : [today]),
    [protocolStartDate, today],
  )

  const startDate = useMemo(
    () => new Date((protocolStartDate || today) + 'T00:00:00'),
    [protocolStartDate, today],
  )

  const getDayOffset = useCallback(
    (date: string) => {
      const d = new Date(date + 'T00:00:00')
      return Math.round(
        (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    },
    [startDate],
  )

  const colorForDate = useCallback(
    (date: string) => {
      const offset = getDayOffset(date)
      return getPhaseColorFromPalette(Math.max(0, offset), phaseColors)
    },
    [getDayOffset, phaseColors],
  )

  const darkColorForDate = useCallback(
    (date: string) => {
      const offset = getDayOffset(date)
      return getPhaseDarkColor(Math.max(0, offset))
    },
    [getDayOffset],
  )

  // Running day counter (only logged days count)
  const dayCounterMap = useMemo(() => {
    const map = new Map<string, number>()
    let counter = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i]!
      if (isLogged(getLogForDate(date))) {
        counter++
        map.set(date, counter)
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, logs])

  const expandedWidth =
    typeof window !== 'undefined' && window.innerWidth < 768
      ? EXPANDED_WIDTH_MOBILE
      : EXPANDED_WIDTH_DESKTOP

  const viewportHeight = VISIBLE_ROWS * ROW_HEIGHT
  const totalDrawerHeight = viewportHeight + STATS_HEIGHT
  const contentHeight = dates.length * ROW_HEIGHT

  // ── Open/close state management ──────────────────────────────────────
  const openDrawer = useCallback(() => {
    setDrawerOpen(true)
    setDrawerWidth(expandedWidth)
    setTimeout(() => setContentVisible(true), 80)
  }, [expandedWidth])

  const closeDrawer = useCallback(() => {
    setContentVisible(false)
    setTimeout(() => {
      setDrawerOpen(false)
      setDrawerWidth(COLLAPSED_WIDTH)
    }, 100)
  }, [])

  const toggleDrawer = useCallback(() => {
    if (drawerOpen) closeDrawer()
    else openDrawer()
  }, [drawerOpen, closeDrawer, openDrawer])

  // ── Click outside to close ───────────────────────────────────────────
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDrawer()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [drawerOpen, closeDrawer])

  // ── Scroll to today on mount ─────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  // CHANGE 6: Removed horizontal swipe gesture entirely — tap-to-toggle only

  // ── Row tap handler ──────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (date: string) => {
      if (drawerOpen) {
        openLogForDate(date)
        closeDrawer()
      }
    },
    [drawerOpen, openLogForDate, closeDrawer],
  )

  // ── Dot column tap (toggle drawer) ───────────────────────────────────
  const handleDotColumnClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleDrawer()
    },
    [toggleDrawer],
  )

  const noStartDate = !protocolStartDate

  // Determine the selected row index based on scroll position
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const idx = Math.round(el.scrollTop / ROW_HEIGHT)
        setSelectedIndex(Math.max(0, Math.min(dates.length - 1, idx)))
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [dates.length])

  // Line color based on selected day's phase darkColor
  const lineColor = useMemo(() => {
    const selectedDate = dates[selectedIndex]
    if (!selectedDate) return phases[0]!.darkColor
    return darkColorForDate(selectedDate)
  }, [dates, selectedIndex, darkColorForDate])

  // Streak calculation: consecutive logged days ending yesterday (today excluded)
  const streak = useMemo(() => {
    let count = 0
    // dates[0] is today (most recent first), so start from dates[1] (yesterday)
    for (let i = 1; i < dates.length; i++) {
      if (isLogged(getLogForDate(dates[i]!))) {
        count++
      } else {
        break
      }
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, logs])

  // Weekly averages for visible 7 days (already scroll-reactive)
  const weeklyAverages = useMemo(() => {
    const visibleDates = dates.slice(selectedIndex, selectedIndex + VISIBLE_ROWS)
    let eSum = 0, mSum = 0, fSum = 0, sSum = 0, count = 0
    for (const d of visibleDates) {
      const log = getLogForDate(d)
      if (log && isLogged(log)) {
        eSum += log.energy
        mSum += log.mood
        fSum += log.fog
        sSum += log.sleep
        count++
      }
    }
    if (count === 0) return null
    return {
      E: Math.round(eSum / count),
      M: Math.round(mSum / count),
      F: Math.round(fSum / count),
      S: Math.round(sSum / count),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, selectedIndex, logs])

  const selectedPhaseColor = useMemo(() => {
    const d = dates[selectedIndex]
    return d ? colorForDate(d) : phaseColors[0]!
  }, [dates, selectedIndex, colorForDate, phaseColors])

  return (
    <div
      ref={containerRef}
      className="fixed left-0"
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        width: drawerWidth,
        height: drawerOpen ? totalDrawerHeight : viewportHeight,
        transition: `width 280ms ${TRANSITION_EASE}, height 280ms ${TRANSITION_EASE}`,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Frosted glass background — always rendered, fills outer container to avoid flash */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '0 12px 12px 0',
          pointerEvents: 'none',
        }}
      />

      {/* Inner container: fixed width, right-aligned */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: expandedWidth,
          height: '100%',
        }}
      >
        {/* Scrollable viewport */}
        <div
          ref={scrollRef}
          className="drawer-scroll"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: viewportHeight,
            overflowY: 'auto',
            scrollSnapType: 'y mandatory',
            touchAction: 'pan-y',
          }}
        >
          {noStartDate ? (
            <div
              style={{
                height: viewportHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: lineColor + '80',
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {drawerOpen ? 'Set start date in Settings' : ''}
            </div>
          ) : (
            <div
              style={{
                height: contentHeight,
                position: 'relative',
                width: '100%',
              }}
            >
              {/* Vertical dot column line with SVG mask cutouts */}
              <svg
                width={DOT_COL_WIDTH}
                height={contentHeight}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                <defs>
                  <mask id="dot-line-mask">
                    <rect x={0} y={0} width={DOT_COL_WIDTH} height={contentHeight} fill="white" />
                    {dates.map((_, i) => (
                      <circle
                        key={i}
                        cx={DOT_X_OFFSET}
                        cy={i * ROW_HEIGHT + ROW_HEIGHT / 2}
                        r={8}
                        fill="black"
                      />
                    ))}
                  </mask>
                </defs>

                {/* Line with mask */}
                <line
                  x1={DOT_X_OFFSET}
                  y1={0}
                  x2={DOT_X_OFFSET}
                  y2={contentHeight}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  mask="url(#dot-line-mask)"
                  style={{
                    stroke: lineColor,
                    transition: 'stroke 200ms',
                  }}
                />

                {/* CHANGE 6: Dots for every day — larger sizes */}
                {dates.map((date, i) => {
                  const log = getLogForDate(date)
                  const logged = isLogged(log)
                  const isToday = date === today
                  const cy = i * ROW_HEIGHT + ROW_HEIGHT / 2
                  const color = colorForDate(date)

                  if (isToday) {
                    if (logged) {
                      return (
                        <circle
                          key={date}
                          cx={DOT_X_OFFSET}
                          cy={cy}
                          r={6}
                          fill={color}
                          style={{
                            filter: `drop-shadow(0 0 6px ${color}88)`,
                          }}
                        />
                      )
                    } else {
                      return (
                        <circle
                          key={date}
                          cx={DOT_X_OFFSET}
                          cy={cy}
                          r={6}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.5}
                          className="ticker-today-pulse"
                        />
                      )
                    }
                  } else if (logged) {
                    return (
                      <circle
                        key={date}
                        cx={DOT_X_OFFSET}
                        cy={cy}
                        r={5}
                        fill={color}
                      />
                    )
                  } else {
                    return (
                      <circle
                        key={date}
                        cx={DOT_X_OFFSET}
                        cy={cy}
                        r={5}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                    )
                  }
                })}
              </svg>

              {/* Rows */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                const isToday = date === today
                const color = colorForDate(date)
                const dayCount = dayCounterMap.get(date)

                // Day quality bar color (inverted fog)
                const avgColor =
                  logged && log
                    ? dayQualityColor(log.energy, log.mood, log.fog, log.sleep)
                    : undefined

                return (
                  <div
                    key={date}
                    data-date={date}
                    style={{
                      position: 'absolute',
                      top: i * ROW_HEIGHT,
                      left: 0,
                      right: 0,
                      height: ROW_HEIGHT,
                      scrollSnapAlign: 'start',
                      display: 'flex',
                      alignItems: 'center',
                      // CHANGE 4: removed borderBottom — 4px visual gap via row spacing
                    }}
                  >
                    {/* Day quality vertical bar on far left */}
                    {logged && avgColor && contentVisible && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 4,
                          bottom: 4,
                          width: 3,
                          backgroundColor: avgColor,
                          borderRadius: 2,
                        }}
                      />
                    )}

                    {/* Row content (metrics) — left of dot column */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        paddingLeft: 8,
                        paddingRight: 0,
                        marginRight: DOT_COL_WIDTH,
                        opacity: contentVisible ? 1 : 0,
                        transition: contentVisible
                          ? 'opacity 200ms 80ms'
                          : 'opacity 100ms',
                        cursor: drawerOpen ? 'pointer' : 'default',
                        overflow: 'hidden',
                      }}
                      onClick={() => handleRowClick(date)}
                    >
                      {/* CHANGE 5+8a: Day counter + date + day-of-week */}
                      <div
                        style={{
                          width: 50,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {isToday ? (
                          <>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 400,
                                color,
                                opacity: 0.8,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                              }}
                            >
                              Today
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                color,
                                opacity: 0.4,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDateShort(date)}
                            </div>
                            {/* CHANGE 8a: Day-of-week */}
                            <div
                              style={{
                                fontSize: 7,
                                color,
                                opacity: 0.2,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                              }}
                            >
                              {getDayOfWeek(date)}
                            </div>
                          </>
                        ) : logged && dayCount != null ? (
                          <>
                            <div
                              style={{
                                fontSize: 11,
                                color,
                                opacity: 0.7,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                              }}
                            >
                              {/* CHANGE 5: "Day X" format */}
                              Day {dayCount}
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                color,
                                opacity: 0.4,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDateShort(date)}
                            </div>
                            {/* CHANGE 8a: Day-of-week */}
                            <div
                              style={{
                                fontSize: 7,
                                color,
                                opacity: 0.2,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                              }}
                            >
                              {getDayOfWeek(date)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                fontSize: 9,
                                color,
                                opacity: 0.4,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDateShort(date)}
                            </div>
                            {/* CHANGE 8a: Day-of-week */}
                            <div
                              style={{
                                fontSize: 7,
                                color,
                                opacity: 0.2,
                                fontFamily: "'JetBrains Mono', monospace",
                                lineHeight: 1.2,
                              }}
                            >
                              {getDayOfWeek(date)}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Progress rings */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <ProgressRing
                          letter="E"
                          value={log?.energy ?? 0}
                          logged={logged}
                        />
                        <ProgressRing
                          letter="M"
                          value={log?.mood ?? 0}
                          logged={logged}
                        />
                        <ProgressRing
                          letter="B"
                          value={log?.fog ?? 0}
                          logged={logged}
                        />
                        <ProgressRing
                          letter="S"
                          value={log?.sleep ?? 0}
                          logged={logged}
                        />
                      </div>

                      {/* CHANGE 3: Flare indicator — 12px padding from rings and right edge */}
                      <div
                        style={{
                          width: 20,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 12,
                          marginRight: 12,
                        }}
                      >
                        {logged && log?.flare && (
                          <FlareIndicator severity={log.flareSeverity ?? 1} />
                        )}
                      </div>
                    </div>

                    {/* CHANGE 6: Dot column hit target — full 32px width tap target */}
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: DOT_COL_WIDTH,
                        height: ROW_HEIGHT,
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                      onClick={handleDotColumnClick}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom weekly stats (fixed, not scrollable) */}
        <div
          style={{
            position: 'absolute',
            top: viewportHeight,
            left: 0,
            right: DOT_COL_WIDTH,
            height: STATS_HEIGHT,
            opacity: drawerOpen && contentVisible ? 1 : 0,
            pointerEvents: drawerOpen ? undefined : 'none',
            transition: contentVisible
              ? 'opacity 200ms 80ms'
              : 'opacity 100ms',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 8,
            paddingRight: 8,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Streak (only show if >= 2) */}
          <div
            style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: selectedPhaseColor,
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            {streak >= 2 ? `${streak} day streak` : ''}
          </div>

          {/* Weekly averages */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              flexShrink: 0,
            }}
          >
            {(['E', 'M', 'F', 'S'] as const).map((key) => (
              <span key={key}>
                <span style={{ color: METRIC_COLORS[key] }}>{key}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  :{weeklyAverages ? weeklyAverages[key] : '-'}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
