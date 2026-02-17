import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

interface Particle {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  opacity: number
  wobblePhase: number
  wobbleSpeed: number
  axisRatio: number // minor/major axis for ellipse
}

export function BackgroundParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Particle count scaled by screen size
    const count = window.innerWidth < 768 ? 40 : 70

    // Initialize particles
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 1.5 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: 0.03 + Math.random() * 0.04,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.005 + Math.random() * 0.01,
      axisRatio: 0.7 + Math.random() * 0.3,
    }))

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Render once, no animation loop
      drawParticles(ctx, canvas.width, canvas.height, particlesRef.current, isDark)
      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    let time = 0

    const animate = () => {
      const w = canvas.width
      const h = canvas.height
      const particles = particlesRef.current
      time += 16

      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        // Update position
        p.x += p.vx
        p.y += p.vy
        p.wobblePhase += p.wobbleSpeed

        // Wrap around edges
        if (p.x < -p.radius) p.x = w + p.radius
        if (p.x > w + p.radius) p.x = -p.radius
        if (p.y < -p.radius) p.y = h + p.radius
        if (p.y > h + p.radius) p.y = -p.radius

        // Draw organic ellipse
        const wobble = Math.sin(p.wobblePhase) * 0.15
        const rx = p.radius * (1 + wobble)
        const ry = p.radius * p.axisRatio * (1 - wobble)

        ctx.beginPath()
        ctx.ellipse(p.x, p.y, rx, ry, p.wobblePhase * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = isDark
          ? `rgba(160, 120, 100, ${p.opacity})`
          : `rgba(200, 160, 140, ${p.opacity})`
        ctx.fill()
      }

      // Draw faint membrane rings (petri dish culture rings)
      const ringCount = 4
      const centerX = w / 2
      const centerY = h / 2
      for (let r = 0; r < ringCount; r++) {
        const baseRadius = (Math.min(w, h) * 0.25) + r * (Math.min(w, h) * 0.15)
        const wobble = Math.sin(time * 0.0003 + r * 1.5) * 8
        const rx = baseRadius + wobble
        const ry = baseRadius * (0.85 + Math.sin(time * 0.0002 + r) * 0.05) + wobble * 0.5
        const rotation = time * 0.00005 * (r % 2 === 0 ? 1 : -1) + r * 0.3

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(rotation)
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.strokeStyle = isDark
          ? `rgba(160, 120, 110, ${0.025 + Math.sin(time * 0.0004 + r) * 0.01})`
          : `rgba(200, 160, 150, ${0.035 + Math.sin(time * 0.0004 + r) * 0.015})`
        ctx.lineWidth = 1.5 + Math.sin(time * 0.0005 + r * 2) * 0.5
        ctx.stroke()
        ctx.restore()
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [isDark])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  particles: Particle[],
  isDark: boolean
) {
  ctx.clearRect(0, 0, w, h)
  for (const p of particles) {
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.radius, p.radius * p.axisRatio, 0, 0, Math.PI * 2)
    ctx.fillStyle = isDark
      ? `rgba(160, 120, 100, ${p.opacity})`
      : `rgba(200, 160, 140, ${p.opacity})`
    ctx.fill()
  }
}
