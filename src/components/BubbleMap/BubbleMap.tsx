import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { ConnectionLines } from './ConnectionLines'
import { BackgroundParticles } from './BackgroundParticles'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_TIME_THRESHOLD = 300

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Pan and zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanningRef = useRef(false)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const lastPinchDistRef = useRef(0)

  // Touch tap detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const hasPannedRef = useRef(false)

  // Active pan tracking (disables spring animation during drag)
  const [isUserPanning, setIsUserPanning] = useState(false)

  // Auto-zoom tracking
  const hasAutoZoomedRef = useRef(false)

  // Refs for native touch event handlers (can't read React state in closure)
  const transformRef = useRef(transform)
  const bubblesRef = useRef<ReturnType<typeof useBubbleLayout>['bubbles']>([])

  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { bubbles, links, settled } = useBubbleLayout(dimensions.width, dimensions.height)

  // Keep refs in sync
  useEffect(() => { transformRef.current = transform }, [transform])
  useEffect(() => { bubblesRef.current = bubbles }, [bubbles])

  // Auto-zoom to current milestone when simulation first settles
  useEffect(() => {
    if (!settled || hasAutoZoomedRef.current || bubbles.length === 0) return
    hasAutoZoomedRef.current = true

    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return

    const scale = 1.2
    setTransform({
      x: dimensions.width / 2 - bubble.x * scale,
      y: dimensions.height / 2 - bubble.y * scale,
      scale,
    })
  }, [settled, bubbles, dimensions, getCurrentMilestone])

  // Pan handlers (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanningRef.current = true
    setIsUserPanning(true)
    lastPanRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return
    const dx = e.clientX - lastPanRef.current.x
    const dy = e.clientY - lastPanRef.current.y
    lastPanRef.current = { x: e.clientX, y: e.clientY }
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false
    setIsUserPanning(false)
  }, [])

  // Zoom handler (wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.3, Math.min(3, t.scale * delta)),
    }))
  }, [])

  // Native touch handlers (passive: false required for preventDefault on mobile)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]!
        isPanningRef.current = true
        setIsUserPanning(true)
        hasPannedRef.current = false
        lastPanRef.current = { x: touch.clientX, y: touch.clientY }
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      } else if (e.touches.length === 2) {
        isPanningRef.current = false
        touchStartRef.current = null
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
        lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanningRef.current) {
        const touch = e.touches[0]!
        const dx = touch.clientX - lastPanRef.current.x
        const dy = touch.clientY - lastPanRef.current.y
        lastPanRef.current = { x: touch.clientX, y: touch.clientY }

        if (touchStartRef.current) {
          const totalDx = touch.clientX - touchStartRef.current.x
          const totalDy = touch.clientY - touchStartRef.current.y
          const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy)
          if (totalDist > TAP_DISTANCE_THRESHOLD) {
            hasPannedRef.current = true
          }
        }

        if (hasPannedRef.current) {
          e.preventDefault()
        }

        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDistRef.current > 0) {
          const delta = dist / lastPinchDistRef.current
          setTransform((t) => ({
            ...t,
            scale: Math.max(0.3, Math.min(3, t.scale * delta)),
          }))
        }
        lastPinchDistRef.current = dist
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      isPanningRef.current = false
      setIsUserPanning(false)
      lastPinchDistRef.current = 0

      if (touchStartRef.current && !hasPannedRef.current) {
        const elapsed = Date.now() - touchStartRef.current.time
        if (elapsed < TAP_TIME_THRESHOLD) {
          const touch = touchStartRef.current
          const rect = containerRef.current?.getBoundingClientRect()
          const offsetX = rect?.left ?? 0
          const offsetY = rect?.top ?? 0
          const svgX = (touch.x - offsetX - transformRef.current.x) / transformRef.current.scale
          const svgY = (touch.y - offsetY - transformRef.current.y) / transformRef.current.scale

          for (const bubble of bubblesRef.current) {
            const dx = svgX - bubble.x
            const dy = svgY - bubble.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist <= bubble.radius) {
              e.preventDefault()
              selectMilestone(bubble.milestoneId)
              break
            }
          }
        }
      }

      touchStartRef.current = null
      hasPannedRef.current = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [selectMilestone])

  // Recenter on current milestone
  const handleRecenter = useCallback(() => {
    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return
    const scale = 1.2
    setTransform({
      x: dimensions.width / 2 - bubble.x * scale,
      y: dimensions.height / 2 - bubble.y * scale,
      scale,
    })
  }, [bubbles, dimensions, getCurrentMilestone])

  // Listen for recenter events from App-level button
  useEffect(() => {
    const handler = () => handleRecenter()
    window.addEventListener('cyto-recenter', handler)
    return () => window.removeEventListener('cyto-recenter', handler)
  }, [handleRecenter])

  const handleBubbleTap = useCallback(
    (milestoneId: string) => {
      selectMilestone(milestoneId)
    },
    [selectMilestone],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-hidden relative"
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Microscope background particles */}
      <BackgroundParticles />

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      >
        <defs>
          {/* Radial gradients for each milestone — solid center fading to transparent edge */}
          {bubbles.map((bubble) => (
            <radialGradient key={`mg-${bubble.milestoneId}`} id={`milestone-grad-${bubble.milestoneId}`}>
              <stop offset="0%" stopColor={getPhaseColor(bubble.phaseIndex, isDark)} stopOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.4 : 0.75} />
              <stop offset="55%" stopColor={getPhaseColor(bubble.phaseIndex, isDark)} stopOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.25 : 0.5} />
              <stop offset="100%" stopColor={getPhaseColor(bubble.phaseIndex, isDark)} stopOpacity={0.0} />
            </radialGradient>
          ))}

          {/* Glow filters for overdue milestones */}
          <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor="#FF8C00" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#FF4444" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.g
          animate={{
            x: transform.x,
            y: transform.y,
            scale: transform.scale,
          }}
          transition={isUserPanning
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
          }
        >
          {/* Connection paths (behind milestones) */}
          <ConnectionLines links={links} />

          {/* Milestone membrane circles — radial gradient gives soft organic edge */}
          {bubbles.map((bubble) => (
            <circle
              key={`membrane-${bubble.milestoneId}`}
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.radius * 1.3}
              fill={`url(#milestone-grad-${bubble.milestoneId})`}
            />
          ))}

          {/* Milestone core circles — solid inner blob */}
          {bubbles.map((bubble) => (
            <circle
              key={`core-${bubble.milestoneId}`}
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.radius * (0.5 + (bubble.progress / 100) * 0.35)}
              fill={getPhaseColor(bubble.phaseIndex, isDark)}
              fillOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.3 : 0.7}
            />
          ))}

          {/* Overlay layer — labels, click targets */}
          {bubbles.map((bubble) => (
            <Bubble
              key={bubble.milestoneId}
              milestoneId={bubble.milestoneId}
              x={bubble.x}
              y={bubble.y}
              radius={bubble.radius}
              progress={bubble.progress}
              onTap={handleBubbleTap}
            />
          ))}
        </motion.g>
      </svg>

    </div>
  )
}
