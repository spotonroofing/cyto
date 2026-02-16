import { useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

interface GooCanvasProps {
  width: number
  height: number
  bubbles: LayoutBubble[]
  links: LayoutLink[]
  transform: { x: number; y: number; scale: number }
}

interface BridgeCircle {
  // Static properties (computed once per layout change)
  baseX: number
  baseY: number
  baseR: number
  color: string
  // Animation properties
  perpX: number  // unit perpendicular vector
  perpY: number
  phase: number  // animation phase offset
  speed: number  // oscillation speed
  amplitude: number
}

function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function GooCanvas({ width, height, bubbles, links, transform }: GooCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bridgesRef = useRef<BridgeCircle[]>([])
  const animFrameRef = useRef<number>(0)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Recompute bridge circles when layout changes
  useEffect(() => {
    const bridges: BridgeCircle[] = []
    const isMobile = width < 768

    for (const link of links) {
      const sx = link.source.x, sy = link.source.y
      const tx = link.target.x, ty = link.target.y
      const dx = tx - sx, dy = ty - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0) continue

      // Perpendicular unit vector
      const px = -dy / dist
      const py = dx / dist

      const sourceColor = getPhaseColor(link.sourcePhaseIndex, isDark)
      const targetColor = getPhaseColor(link.targetPhaseIndex, isDark)

      // Bridge circle count: more for longer distances, fewer on mobile
      const count = isMobile ? 6 : 10

      for (let i = 0; i <= count; i++) {
        const t = i / count
        const x = sx + dx * t
        const y = sy + dy * t

        // Radius: larger near milestones, thinner in middle (hourglass shape)
        // but with a minimum to prevent spider-thin connections
        const distFromCenter = Math.abs(t - 0.5) * 2 // 0 at center, 1 at ends
        const endR = Math.min(link.source.radius, link.target.radius) * 0.5
        const midR = endR * 0.45 // minimum thickness at center
        const r = midR + (endR - midR) * distFromCenter * distFromCenter

        bridges.push({
          baseX: x,
          baseY: y,
          baseR: r,
          color: lerpColor(sourceColor, targetColor, t),
          perpX: px,
          perpY: py,
          phase: t * Math.PI * 2 + Math.random() * 0.5,
          speed: 0.3 + Math.random() * 0.2,
          amplitude: 2 + Math.random() * 3,
        })
      }
    }

    bridgesRef.current = bridges
  }, [links, bubbles, width, isDark])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas resolution (handle devicePixelRatio for sharpness)
    const dpr = Math.min(window.devicePixelRatio || 1, 2) // cap at 2x for perf
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    let time = 0

    const draw = () => {
      time += 0.016 // ~60fps timestep

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.scale, transform.scale)

      // Draw bridge circles (goo connectors) — these animate
      const bridges = bridgesRef.current
      for (const b of bridges) {
        const offset = Math.sin(time * b.speed + b.phase) * b.amplitude
        const x = b.baseX + b.perpX * offset
        const y = b.baseY + b.perpY * offset
        // Also pulse radius slightly
        const rPulse = b.baseR + Math.sin(time * 0.4 + b.phase) * 1.5

        ctx.beginPath()
        ctx.arc(x, y, Math.max(rPulse, 3), 0, Math.PI * 2)
        ctx.fillStyle = b.color
        ctx.fill()
      }

      // Draw milestone circles (these breathe gently)
      for (const bubble of bubbles) {
        const breathe = Math.sin(time * 0.5 + bubble.phaseIndex * 0.8) * 2
        const r = bubble.radius + breathe

        ctx.beginPath()
        ctx.arc(bubble.x, bubble.y, r, 0, Math.PI * 2)
        ctx.fillStyle = getPhaseColor(bubble.phaseIndex, isDark)
        ctx.fill()
      }

      ctx.restore()

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [width, height, transform, bubbles, isDark])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: 'none',
        filter: 'url(#goo-filter)',
      }}
    />
  )
}
