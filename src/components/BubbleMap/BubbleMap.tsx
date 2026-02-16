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

  // Touch handlers — fixed tap vs pan detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]!
      isPanningRef.current = true
      setIsUserPanning(true)
      hasPannedRef.current = false
      lastPanRef.current = { x: touch.clientX, y: touch.clientY }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    } else if (e.touches.length === 2) {
      // Pinch start — cancel any pending tap
      isPanningRef.current = false
      touchStartRef.current = null
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanningRef.current) {
      const touch = e.touches[0]!
      const dx = touch.clientX - lastPanRef.current.x
      const dy = touch.clientY - lastPanRef.current.y
      lastPanRef.current = { x: touch.clientX, y: touch.clientY }

      // Check if we've moved enough to consider it a pan
      if (touchStartRef.current) {
        const totalDx = touch.clientX - touchStartRef.current.x
        const totalDy = touch.clientY - touchStartRef.current.y
        const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy)
        if (totalDist > TAP_DISTANCE_THRESHOLD) {
          hasPannedRef.current = true
        }
      }

      // Only prevent default once we're actually panning
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
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      isPanningRef.current = false
      setIsUserPanning(false)
      lastPinchDistRef.current = 0

      // Check if this was a tap (short, minimal movement)
      if (touchStartRef.current && !hasPannedRef.current) {
        const elapsed = Date.now() - touchStartRef.current.time
        if (elapsed < TAP_TIME_THRESHOLD) {
          // Find if a bubble was tapped
          const touch = touchStartRef.current
          // Account for container offset before converting to SVG coordinates
          const rect = containerRef.current?.getBoundingClientRect()
          const offsetX = rect?.left ?? 0
          const offsetY = rect?.top ?? 0
          const svgX = (touch.x - offsetX - transform.x) / transform.scale
          const svgY = (touch.y - offsetY - transform.y) / transform.scale

          for (const bubble of bubbles) {
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
    },
    [bubbles, transform, selectMilestone],
  )

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Microscope background particles */}
      <BackgroundParticles />

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      >
        {/* SVG filters */}
        <defs>
          {/* Goo filter — merges nearby circles into organic blobs */}
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" colorInterpolationFilters="sRGB" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
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
          {/* Goo layer — milestone circles + bridge connections merge organically */}
          <g filter="url(#goo)">
            <ConnectionLines links={links} />
            {bubbles.map((bubble) => (
              <circle
                key={bubble.milestoneId}
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius}
                fill={getPhaseColor(bubble.phaseIndex, isDark)}
                fillOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.55 : 0.85}
              />
            ))}
          </g>

          {/* Overlay layer — labels, progress rings, click targets (NOT goo filtered) */}
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
