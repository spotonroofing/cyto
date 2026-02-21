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
  transform: { x: number; y: number; scale: number }
}

export function BackgroundParticles({ transform }: BackgroundParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const transformRef = useRef(transform)
  const { palette } = useTheme()

  // Keep transform ref in sync without re-running the main effect
  useEffect(() => { transformRef.current = transform }, [transform])

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

    // Initialize particles in world space (same coordinate system as cells/paths)
    const tf = transformRef.current
    const pad = 200 // world-space padding beyond viewport edges
    const worldLeft = -tf.x / tf.scale - pad
    const worldTop = -tf.y / tf.scale - pad
    const worldW = canvas.width / tf.scale + pad * 2
    const worldH = canvas.height / tf.scale + pad * 2

    particlesRef.current = Array.from({ length: count }, () => {
      const opacity = 0.11 + Math.random() * 0.12
      return {
        x: worldLeft + Math.random() * worldW,
        y: worldTop + Math.random() * worldH,
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
      const tf = transformRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(tf.x, tf.y)
      ctx.scale(tf.scale, tf.scale)
      for (const p of particlesRef.current) {
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.radius, p.radius * p.axisRatio, 0, 0, Math.PI * 2)
        ctx.fillStyle = p.fillStyle
        ctx.fill()
      }
      ctx.restore()
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
      const tf = transformRef.current

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(tf.x, tf.y)
      ctx.scale(tf.scale, tf.scale)

      // Visible world rect for wrapping (with padding so particles don't pop in at edges)
      const wPad = 100
      const wLeft = -tf.x / tf.scale - wPad
      const wTop = -tf.y / tf.scale - wPad
      const wW = w / tf.scale + wPad * 2
      const wH = h / tf.scale + wPad * 2

      for (const p of particles) {
        // Update position (world-space drift)
        p.x += p.vx
        p.y += p.vy
        p.wobblePhase += p.wobbleSpeed

        // Wrap around visible world-space edges
        if (p.x < wLeft) p.x += wW
        else if (p.x > wLeft + wW) p.x -= wW
        if (p.y < wTop) p.y += wH
        else if (p.y > wTop + wH) p.y -= wH

        // Draw organic ellipse — radius is in world units, camera transform handles scaling
        const wobble = Math.sin(p.wobblePhase) * 0.15
        const rx = p.radius * (1 + wobble)
        const ry = p.radius * p.axisRatio * (1 - wobble)

        ctx.beginPath()
        ctx.ellipse(p.x, p.y, rx, ry, p.wobblePhase * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = p.fillStyle
        ctx.fill()
      }

      ctx.restore()
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
