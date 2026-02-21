import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/themes'

export function FpsCounter() {
  const { phaseColor } = useTheme()
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      frameCountRef.current++
      const now = performance.now()
      if (now - lastTimeRef.current >= 500) {
        setFps(Math.round(frameCountRef.current / ((now - lastTimeRef.current) / 1000)))
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <span
      style={{
        color: fps < 20 ? '#ef4444' : fps < 40 ? '#f59e0b' : phaseColor(2),
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px',
        opacity: 0.45,
      }}
    >
      {fps} fps
    </span>
  )
}
