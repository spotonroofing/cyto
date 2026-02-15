import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { ConnectionLines } from './ConnectionLines'
import { RecenterButton } from './RecenterButton'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Pan and zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanningRef = useRef(false)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const lastPinchDistRef = useRef(0)

  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)

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

  const { bubbles, links } = useBubbleLayout(dimensions.width, dimensions.height)

  // Pan handlers (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanningRef.current = true
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

  // Touch handlers (pan + pinch)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isPanningRef.current = true
      lastPanRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanningRef.current) {
      const dx = e.touches[0]!.clientX - lastPanRef.current.x
      const dy = e.touches[0]!.clientY - lastPanRef.current.y
      lastPanRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    } else if (e.touches.length === 2) {
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

  const handleTouchEnd = useCallback(() => {
    isPanningRef.current = false
    lastPinchDistRef.current = 0
  }, [])

  // Recenter on current milestone
  const handleRecenter = useCallback(() => {
    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return
    setTransform({
      x: dimensions.width / 2 - bubble.x,
      y: dimensions.height / 2 - bubble.y,
      scale: 1,
    })
  }, [bubbles, dimensions, getCurrentMilestone])

  const handleBubbleTap = useCallback(
    (milestoneId: string) => {
      selectMilestone(milestoneId)
    },
    [selectMilestone],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-hidden relative touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      >
        {/* SVG filters for glow effects */}
        <defs>
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
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {/* Connection lines (behind bubbles) */}
          <ConnectionLines links={links} />

          {/* Bubbles */}
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

      {/* Recenter button */}
      <RecenterButton onRecenter={handleRecenter} />
    </div>
  )
}
