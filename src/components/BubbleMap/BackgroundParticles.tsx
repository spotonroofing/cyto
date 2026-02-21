import { useEffect, useRef } from 'react'
import { useTheme } from '@/themes'
import { Q, IS_MOBILE, mobileIdle } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'
import { useTuningStore } from '@/stores/tuningStore'

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

interface MapBounds {
  minX: number; maxX: number; minY: number; maxY: number
}

interface BackgroundParticlesProps {
  transform: { x: number; y: number; scale: number }
  mapBounds: MapBounds | null
}

export function BackgroundParticles({ transform, mapBounds }: BackgroundParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef<number>(0)
  const transformRef = useRef(transform)
  const mapBoundsRef = useRef(mapBounds)
  const { palette } = useTheme()
  const debugParticleCount = useDebugStore((s) => s.particleCount)
  const tuningParticleCount = useTuningStore((s) => s.particleCount)

  // Inline ref assignment eliminates 1-frame lag between particles and map during panning
  transformRef.current = transform
  mapBoundsRef.current = mapBounds

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

    // Particle count from tuning store, scaled by debug multiplier
    const count = Math.round(tuningParticleCount * debugParticleCount)

    // particle base is "rgb(r,g,b)" — extract for rgba usage
    const particleBase = palette.particle
    const rgbInner = particleBase.replace('rgb(', '').replace(')', '')

    // Initialize particles across the full map bounding box (world space)
    const bounds = mapBoundsRef.current
    if (!bounds) {
      // No map bounds yet — clean up and wait for next run
      return () => { window.removeEventListener('resize', resize) }
    }
    const worldLeft = bounds.minX
    const worldTop = bounds.minY
    const worldW = bounds.maxX - bounds.minX
    const worldH = bounds.maxY - bounds.minY

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
    let idlePollTimeout = 0

    const animate = (timestamp: number) => {
      // On mobile idle: pause particle animation to save CPU.
      // Particles are non-critical background decoration — no visual impact from pausing.
      if (IS_MOBILE && mobileIdle.active) {
        idlePollTimeout = window.setTimeout(() => {
          idlePollTimeout = 0
          animFrameRef.current = requestAnimationFrame(animate)
        }, 500)
        return
      }

      const dbg = useDebugStore.getState()

      // Frame rate limiting — debug fpsCap overrides component default
      const effectiveDT = dbg.fpsCap > 0 ? 1000 / dbg.fpsCap : TARGET_DT
      if (timestamp - lastFrameTime < effectiveDT * 0.8) {
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = timestamp

      const w = canvas.width
      const h = canvas.height
      const particles = particlesRef.current
      const tf = transformRef.current

      ctx.clearRect(0, 0, w, h)

      // Skip all particle drawing when toggle is OFF
      if (!dbg.particles) {
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }

      ctx.save()
      ctx.translate(tf.x, tf.y)
      ctx.scale(tf.scale, tf.scale)

      // Apply debug opacity multiplier
      if (dbg.particleOpacity < 1) ctx.globalAlpha = dbg.particleOpacity

      // Map world rect for wrapping (particles stay within map bounds, not viewport)
      const mb = mapBoundsRef.current
      const wLeft = mb ? mb.minX : -tf.x / tf.scale
      const wTop = mb ? mb.minY : -tf.y / tf.scale
      const wW = mb ? (mb.maxX - mb.minX) : w / tf.scale
      const wH = mb ? (mb.maxY - mb.minY) : h / tf.scale

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

        // Viewport culling — skip particles outside visible screen
        const screenX = p.x * tf.scale + tf.x
        const screenY = p.y * tf.scale + tf.y
        if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) continue

        // Draw organic ellipse — radius is in world units, camera transform handles scaling
        const wobble = Math.sin(p.wobblePhase) * 0.15
        const rx = p.radius * (1 + wobble)
        const ry = p.radius * p.axisRatio * (1 - wobble)

        ctx.beginPath()
        ctx.ellipse(p.x, p.y, rx, ry, p.wobblePhase * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = p.fillStyle
        ctx.fill()
      }

      if (dbg.particleOpacity < 1) ctx.globalAlpha = 1
      ctx.restore()
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate as FrameRequestCallback)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      clearTimeout(idlePollTimeout)
      window.removeEventListener('resize', resize)
    }
  }, [palette, debugParticleCount, tuningParticleCount, mapBounds])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
