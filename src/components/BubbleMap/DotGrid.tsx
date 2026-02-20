import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'

interface DotGridProps {
  width: number
  height: number
  transform: { x: number; y: number; scale: number }
}

const DOT_SPACING = 35
const DOT_RADIUS = 1.5

export function DotGrid({ width, height, transform }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { isDark } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    // Dot color: light gray in light mode, medium gray in dark mode
    ctx.fillStyle = isDark
      ? 'rgba(102, 102, 102, 0.20)'
      : 'rgba(180, 180, 180, 0.30)'

    const { x: tx, y: ty, scale } = transform
    const scaledSpacing = DOT_SPACING * scale
    const scaledRadius = DOT_RADIUS * scale

    // Skip drawing if dots would be invisibly small
    if (scaledRadius < 0.3) {
      ctx.restore()
      return
    }

    // Compute world-space bounds of the visible viewport
    const worldLeft = -tx / scale
    const worldTop = -ty / scale
    const worldRight = (width - tx) / scale
    const worldBottom = (height - ty) / scale

    // Snap to grid — find first/last grid indices in view
    const startCol = Math.floor(worldLeft / DOT_SPACING)
    const endCol = Math.ceil(worldRight / DOT_SPACING)
    const startRow = Math.floor(worldTop / DOT_SPACING)
    const endRow = Math.ceil(worldBottom / DOT_SPACING)

    // Draw dots in screen space using the transform
    const TAU = Math.PI * 2
    for (let row = startRow; row <= endRow; row++) {
      const screenY = row * scaledSpacing + ty
      for (let col = startCol; col <= endCol; col++) {
        const screenX = col * scaledSpacing + tx
        ctx.beginPath()
        ctx.arc(screenX, screenY, scaledRadius, 0, TAU)
        ctx.fill()
      }
    }

    ctx.restore()
  }, [width, height, transform, isDark])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
