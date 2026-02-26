import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

// ── Layout constants ──────────────────────────────────────────────────────
const COLLAPSED_WIDTH = 24
const EXPANDED_WIDTH_MOBILE = 240
const EXPANDED_WIDTH_DESKTOP = 260
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 7
const PADDING_Y = 20
const CURVE_R = 12
const CURVE_AREA = 20
const DOT_COL_WIDTH = 24
const DOT_X_OFFSET = 12 // dot column center from right edge of drawer

// ── Progress ring constants ───────────────────────────────────────────────
const RING_SIZE = 32
const RING_STROKE = 2.5
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_RADIUS

const METRIC_COLORS: Record<string, string> = {
  E: '#F5A623',
  M: '#7ED688',
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
  const color = METRIC_COLORS[letter] ?? '#888'
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
        fill={`rgba(255,255,255,${logged ? 0.5 : 0.2})`}
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
      >
        {letter}
      </text>
    </svg>
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
  const [isDragging, setIsDragging] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<{
    startX: number
    startY: number
    decided: boolean
    isHorizontal: boolean
    startWidth: number
  } | null>(null)

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

  const lineColor = useMemo(() => {
    const offset = getDayOffset(today)
    return getPhaseDarkColor(Math.max(0, offset))
  }, [getDayOffset, today])

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
  const totalDrawerHeight = viewportHeight + PADDING_Y * 2 + CURVE_AREA * 2
  const contentHeight = dates.length * ROW_HEIGHT

  // ── Open/close state management ──────────────────────────────────────
  const openDrawer = useCallback(() => {
    setDrawerOpen(true)
    setDrawerWidth(expandedWidth)
    // Fade in content after slight delay
    setTimeout(() => setContentVisible(true), 80)
  }, [expandedWidth])

  const closeDrawer = useCallback(() => {
    setContentVisible(false)
    // Collapse width after content fades out
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
    // Today is dates[0] (most recent first), so scroll to top
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  // ── Touch handling for drag open/close + vertical scroll ─────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0]!
      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        decided: false,
        isHorizontal: false,
        startWidth: drawerOpen ? expandedWidth : COLLAPSED_WIDTH,
      }
    },
    [drawerOpen, expandedWidth],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return
      const t = e.touches[0]!
      const dx = t.clientX - touchRef.current.startX
      const dy = t.clientY - touchRef.current.startY

      if (!touchRef.current.decided) {
        if (Math.abs(dx) + Math.abs(dy) < 10) return
        touchRef.current.decided = true
        touchRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy)
        if (touchRef.current.isHorizontal) {
          setIsDragging(true)
        }
      }

      if (touchRef.current.isHorizontal) {
        e.preventDefault()
        const newWidth = Math.max(
          COLLAPSED_WIDTH,
          Math.min(expandedWidth, touchRef.current.startWidth + dx),
        )
        setDrawerWidth(newWidth)
        setContentVisible(newWidth > expandedWidth * 0.3)
      }
    },
    [expandedWidth],
  )

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current) return
    const wasHorizontal = touchRef.current.isHorizontal
    touchRef.current = null
    setIsDragging(false)

    if (!wasHorizontal) return

    // Snap open or closed based on threshold
    if (drawerWidth > expandedWidth * 0.5) {
      openDrawer()
    } else {
      closeDrawer()
    }
  }, [drawerWidth, expandedWidth, openDrawer, closeDrawer])

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
      // Only toggle if it was a true tap (not end of drag)
      if (!isDragging) {
        e.stopPropagation()
        toggleDrawer()
      }
    },
    [isDragging, toggleDrawer],
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

  return (
    <div
      ref={containerRef}
      className="fixed left-0"
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        width: drawerWidth,
        height: totalDrawerHeight,
        transition: isDragging
          ? 'none'
          : `width 280ms ${TRANSITION_EASE}`,
        zIndex: 10,
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
        {/* Background glass (only visible when open) */}
        <div
          style={{
            position: 'absolute',
            top: CURVE_AREA,
            left: 0,
            right: DOT_COL_WIDTH,
            bottom: CURVE_AREA,
            background:
              drawerWidth > COLLAPSED_WIDTH
                ? 'rgba(10, 8, 18, 0.88)'
                : 'transparent',
            backdropFilter:
              drawerWidth > COLLAPSED_WIDTH ? 'blur(14px)' : 'none',
            WebkitBackdropFilter:
              drawerWidth > COLLAPSED_WIDTH ? 'blur(14px)' : 'none',
            borderRadius: '0 12px 12px 0',
            transition: isDragging
              ? 'none'
              : `background 280ms ${TRANSITION_EASE}, backdrop-filter 280ms ${TRANSITION_EASE}`,
            opacity: contentVisible ? 1 : 0,
            pointerEvents: 'none',
          }}
        />

        {/* Top rack-mount curve SVG */}
        <svg
          width={expandedWidth}
          height={CURVE_AREA}
          style={{ position: 'absolute', top: 0, left: 0 }}
          className="pointer-events-none"
        >
          <path
            d={`M 0,${CURVE_AREA} L ${expandedWidth - DOT_COL_WIDTH - CURVE_R},${CURVE_AREA} A ${CURVE_R},${CURVE_R} 0 0,1 ${expandedWidth - DOT_COL_WIDTH},${CURVE_AREA - CURVE_R} L ${expandedWidth - DOT_COL_WIDTH},0`}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeOpacity={0.5}
          />
        </svg>

        {/* Bottom rack-mount curve SVG */}
        <svg
          width={expandedWidth}
          height={CURVE_AREA}
          style={{ position: 'absolute', bottom: 0, left: 0 }}
          className="pointer-events-none"
        >
          <path
            d={`M ${expandedWidth - DOT_COL_WIDTH},0 L ${expandedWidth - DOT_COL_WIDTH},${CURVE_R} A ${CURVE_R},${CURVE_R} 0 0,1 ${expandedWidth - DOT_COL_WIDTH - CURVE_R},${CURVE_AREA} L 0,${CURVE_AREA}`}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeOpacity={0.5}
          />
        </svg>

        {/* Scrollable viewport */}
        <div
          ref={scrollRef}
          className="drawer-scroll"
          style={{
            position: 'absolute',
            top: CURVE_AREA + PADDING_Y,
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
              {/* Vertical dot column line */}
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
                <line
                  x1={DOT_X_OFFSET}
                  y1={0}
                  x2={DOT_X_OFFSET}
                  y2={contentHeight}
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                />

                {/* Dot halos + dots */}
                {dates.map((date, i) => {
                  const log = getLogForDate(date)
                  const logged = isLogged(log)
                  const isToday = date === today
                  if (!logged && !isToday) return null

                  const cy = i * ROW_HEIGHT + ROW_HEIGHT / 2
                  const color = colorForDate(date)
                  const isSel = i === selectedIndex

                  return (
                    <g key={date}>
                      {/* Dark halo to interrupt line */}
                      <circle
                        cx={DOT_X_OFFSET}
                        cy={cy}
                        r={6}
                        fill="rgba(10, 8, 18, 0.9)"
                      />
                      {logged ? (
                        <circle
                          cx={DOT_X_OFFSET}
                          cy={cy}
                          r={isSel ? 6 : isToday ? 5 : 4}
                          fill={color}
                          style={{
                            transition: 'r 100ms ease-out',
                            filter: isSel
                              ? `drop-shadow(0 0 8px ${color}66)`
                              : isToday
                                ? `drop-shadow(0 0 4px ${color}44)`
                                : 'none',
                          }}
                        />
                      ) : (
                        /* Today unlogged: hollow pulse */
                        <circle
                          cx={DOT_X_OFFSET}
                          cy={cy}
                          r={isSel ? 6 : 5}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.5}
                          className="ticker-today-pulse"
                          style={{ transition: 'r 100ms ease-out' }}
                        />
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Rows */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                const isToday = date === today
                const color = colorForDate(date)
                const dayCount = dayCounterMap.get(date)

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
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Row content (metrics) — left of dot column */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        paddingLeft: 8,
                        paddingRight: 4,
                        marginRight: DOT_COL_WIDTH,
                        opacity: contentVisible ? 1 : 0,
                        transition: isDragging
                          ? 'none'
                          : contentVisible
                            ? 'opacity 200ms 80ms'
                            : 'opacity 100ms',
                        cursor: drawerOpen ? 'pointer' : 'default',
                        overflow: 'hidden',
                      }}
                      onClick={() => handleRowClick(date)}
                    >
                      {/* Day counter + date label (50px) */}
                      <div
                        style={{
                          width: 50,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {dayCount != null && (
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color,
                              opacity: 0.8,
                              fontFamily: "'JetBrains Mono', monospace",
                              lineHeight: 1.2,
                            }}
                          >
                            {dayCount}
                          </div>
                        )}
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
                          {isToday ? 'Today' : formatDateShort(date)}
                        </div>
                      </div>

                      {/* 4 progress rings */}
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
                          letter="F"
                          value={log?.fog ?? 0}
                          logged={logged}
                        />
                        <ProgressRing
                          letter="S"
                          value={log?.sleep ?? 0}
                          logged={logged}
                        />
                      </div>

                      {/* Flare indicator */}
                      <div
                        style={{
                          width: 20,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          marginLeft: 4,
                        }}
                      >
                        {logged && log?.flare && (
                          <>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#FF6B4A',
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                            />
                            {log.flareSeverity != null && (
                              <span
                                style={{
                                  fontSize: 8,
                                  color: '#FF6B4A',
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {log.flareSeverity}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dot column hit target (for tap to toggle) */}
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
      </div>
    </div>
  )
}
