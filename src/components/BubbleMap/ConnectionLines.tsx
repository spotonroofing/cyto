import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutLink } from './useBubbleLayout'

const PATH_WIDTH = 12
const PULSE_RADIUS = 4
const PULSE_COUNT = 2
const PULSE_DURATION = 4

interface ConnectionLinesProps {
  links: LayoutLink[]
}

function bezierPoint(
  sx: number, sy: number,
  cx: number, cy: number,
  tx: number, ty: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt * mt * sx + 2 * mt * t * cx + t * t * tx,
    y: mt * mt * sy + 2 * mt * t * cy + t * t * ty,
  }
}

export function ConnectionLines({ links }: ConnectionLinesProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  return (
    <>
      {/* Gradient definitions for each link */}
      <defs>
        {links.map((link, i) => {
          const sourceColor = getPhaseColor(link.sourcePhaseIndex, isDark)
          const targetColor = getPhaseColor(link.targetPhaseIndex, isDark)
          return (
            <linearGradient
              key={`grad-${i}`}
              id={`connection-grad-${i}`}
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={sourceColor} />
              <stop offset="100%" stopColor={targetColor} />
            </linearGradient>
          )
        })}
      </defs>

      {links.map((link, i) => {
        const isBlocked = link.targetStatus === 'blocked' || link.targetStatus === 'not_started'
        const isActive = (link.sourceStatus === 'completed' || link.sourceStatus === 'in_progress') && !isBlocked
        const pathOpacity = isBlocked ? 0.12 : 0.35

        const sx = link.source.x, sy = link.source.y
        const tx = link.target.x, ty = link.target.y
        const dx = tx - sx, dy = ty - sy

        // Control point for quadratic bezier (organic curve)
        const cx = (sx + tx) / 2 + dy * 0.18
        const cy = (sy + ty) / 2 - dx * 0.18

        // SVG quadratic bezier path
        const pathD = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`

        // Pulse keyframes
        const pulseKeyframes = isActive
          ? Array.from({ length: 8 }, (_, k) => bezierPoint(sx, sy, cx, cy, tx, ty, k / 7))
          : []

        return (
          <g key={i}>
            {/* Outer glow path — wider, more transparent */}
            <path
              d={pathD}
              fill="none"
              stroke={`url(#connection-grad-${i})`}
              strokeWidth={PATH_WIDTH + 8}
              strokeOpacity={pathOpacity * 0.3}
              strokeLinecap="round"
            />

            {/* Main connection path */}
            <path
              d={pathD}
              fill="none"
              stroke={`url(#connection-grad-${i})`}
              strokeWidth={PATH_WIDTH}
              strokeOpacity={pathOpacity}
              strokeLinecap="round"
            />

            {/* Inner bright core */}
            <path
              d={pathD}
              fill="none"
              stroke={`url(#connection-grad-${i})`}
              strokeWidth={3}
              strokeOpacity={pathOpacity * 1.5}
              strokeLinecap="round"
            />

            {/* Energy pulse dots — animate along the path for active connections */}
            {isActive && Array.from({ length: PULSE_COUNT }, (_, pi) => (
              <motion.circle
                key={`p${pi}`}
                r={PULSE_RADIUS}
                fill={`url(#connection-grad-${i})`}
                fillOpacity={0.6}
                animate={{
                  cx: pulseKeyframes.map(p => p.x),
                  cy: pulseKeyframes.map(p => p.y),
                }}
                transition={{
                  duration: PULSE_DURATION,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: pi * (PULSE_DURATION / PULSE_COUNT),
                }}
              />
            ))}
          </g>
        )
      })}
    </>
  )
}
