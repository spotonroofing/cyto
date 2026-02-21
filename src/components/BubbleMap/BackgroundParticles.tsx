import { useEffect, useRef } from 'react'
import { useTheme } from '@/themes'
import { Q } from '@/utils/performanceTier'

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
  fillStyle: string // pre-computed rgba string
}

interface BackgroundParticlesProps {
  scale?: number
}

export function BackgroundParticles({ scale = 1 }: BackgroundParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const scaleRef = useRef(scale)
  const { palette } = useTheme()

  // Keep scale ref in sync without re-running the main effect
  useEffect(() => { scaleRef.current = scale }, [scale])

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

    // Particle count from quality tier — fewer on mobile
    const count = Q.particleCount

    // particle base is "rgb(r,g,b)" — extract for rgba usage
    const particleBase = palette.particle
    const rgbInner = particleBase.replace('rgb(', '').replace(')', '')

    // Initialize particles with pre-computed fill styles
    particlesRef.current = Array.from({ length: count }, () => {
      const opacity = 0.13 + Math.random() * 0.15
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 1.5 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        opacity,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.005 + Math.random() * 0.01,
        axisRatio: 0.7 + Math.random() * 0.3,
        fillStyle: `rgba(${rgbInner}, ${opacity})`,
      }
    })

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Render once, no animation loop
      drawParticles(ctx, canvas.width, canvas.height, particlesRef.current, scaleRef.current)
      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    let lastFrameTime = 0
    const TARGET_DT = Q.particleTargetDt

    const animate = (timestamp: number) => {
      // Frame rate limiting
      if (timestamp - lastFrameTime < TARGET_DT * 0.8) {
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = timestamp

      const w = canvas.width
      const h = canvas.height
      const particles = particlesRef.current

      ctx.clearRect(0, 0, w, h)

      const s = scaleRef.current

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

        // Draw organic ellipse — scale radius with map zoom
        const wobble = Math.sin(p.wobblePhase) * 0.15
        const rx = p.radius * (1 + wobble) * s
        const ry = p.radius * p.axisRatio * (1 - wobble) * s

        ctx.beginPath()
        ctx.ellipse(p.x, p.y, rx, ry, p.wobblePhase * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = p.fillStyle
        ctx.fill()
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate as FrameRequestCallback)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [palette])

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
  s: number = 1,
) {
  ctx.clearRect(0, 0, w, h)
  for (const p of particles) {
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.radius * s, p.radius * p.axisRatio * s, 0, 0, Math.PI * 2)
    ctx.fillStyle = p.fillStyle
    ctx.fill()
  }
}
