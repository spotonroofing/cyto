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
    const count = window.innerWidth < 768 ? 20 : 30

    // Initialize particles
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 4 + Math.random() * 12,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: 0.04 + Math.random() * 0.06,
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

    const animate = () => {
      const w = canvas.width
      const h = canvas.height
      const particles = particlesRef.current

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
          ? `rgba(196, 154, 108, ${p.opacity})`
          : `rgba(212, 165, 116, ${p.opacity})`
        ctx.fill()

        // Membrane outline
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, rx * 1.05, ry * 1.05, p.wobblePhase * 0.5, 0, Math.PI * 2)
        ctx.strokeStyle = isDark
          ? `rgba(196, 154, 108, ${p.opacity * 1.5})`
          : `rgba(212, 165, 116, ${p.opacity * 1.5})`
        ctx.lineWidth = 0.5
        ctx.stroke()
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
      ? `rgba(196, 154, 108, ${p.opacity})`
      : `rgba(212, 165, 116, ${p.opacity})`
    ctx.fill()

    // Membrane outline
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.radius * 1.05, p.radius * p.axisRatio * 1.05, 0, 0, Math.PI * 2)
    ctx.strokeStyle = isDark
      ? `rgba(196, 154, 108, ${p.opacity * 1.5})`
      : `rgba(212, 165, 116, ${p.opacity * 1.5})`
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}
