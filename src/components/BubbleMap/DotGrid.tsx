import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'
import { Q } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'

interface DotGridProps {
  width: number
  height: number
  transform: { x: number; y: number; scale: number }
}

const DOT_SPACING = Q.dotSpacing
const DOT_RADIUS = 1.5

export function DotGrid({ width, height, transform }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transformRef = useRef(transform)
  const { isDark } = useTheme()

  // Keep transform in sync via ref — avoids redraw on every React re-render
  useEffect(() => { transformRef.current = transform }, [transform])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, Q.dotDpr)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // Dot color: light gray in light mode, medium gray in dark mode
    const dotColor = isDark
      ? 'rgba(102, 102, 102, 0.20)'
      : 'rgba(180, 180, 180, 0.30)'

    let lastTf = { x: NaN, y: NaN, scale: NaN }
    let rafId = 0
    const TAU = Math.PI * 2

    const draw = () => {
      rafId = requestAnimationFrame(draw)

      const tf = transformRef.current

      // Skip drawing when grid toggle is OFF
      if (!useDebugStore.getState().grid) {
        if (lastTf.scale !== -1) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          lastTf = { x: NaN, y: NaN, scale: -1 }
        }
        return
      }

      // Only redraw when transform actually changes
      if (tf.x === lastTf.x && tf.y === lastTf.y && tf.scale === lastTf.scale) return
      lastTf = { x: tf.x, y: tf.y, scale: tf.scale }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const scaledSpacing = DOT_SPACING * tf.scale
      const scaledRadius = DOT_RADIUS * tf.scale

      // Skip drawing if dots would be invisibly small
      if (scaledRadius < 0.3) {
        ctx.restore()
        return
      }

      ctx.fillStyle = dotColor

      // Compute world-space bounds of the visible viewport
      const worldLeft = -tf.x / tf.scale
      const worldTop = -tf.y / tf.scale
      const worldRight = (width - tf.x) / tf.scale
      const worldBottom = (height - tf.y) / tf.scale

      // Snap to grid — find first/last grid indices in view
      const startCol = Math.floor(worldLeft / DOT_SPACING)
      const endCol = Math.ceil(worldRight / DOT_SPACING)
      const startRow = Math.floor(worldTop / DOT_SPACING)
      const endRow = Math.ceil(worldBottom / DOT_SPACING)

      // Batch all dots into a single path — one fill() call instead of hundreds
      ctx.beginPath()
      for (let row = startRow; row <= endRow; row++) {
        const screenY = row * scaledSpacing + tf.y
        for (let col = startCol; col <= endCol; col++) {
          const screenX = col * scaledSpacing + tf.x
          ctx.moveTo(screenX + scaledRadius, screenY)
          ctx.arc(screenX, screenY, scaledRadius, 0, TAU)
        }
      }
      ctx.fill()

      ctx.restore()
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [width, height, isDark]) // transform removed from deps — read from ref

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
