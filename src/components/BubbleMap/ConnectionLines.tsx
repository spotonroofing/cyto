import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutLink } from './useBubbleLayout'

const BRIDGE_RADIUS = 8
const BRIDGE_SPACING = 14
const PULSE_RADIUS = 5
const PULSE_COUNT = 3
const PULSE_DURATION = 3.5

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
    <g>
      {links.map((link, i) => {
        const color = getPhaseColor(link.sourcePhaseIndex, isDark)
        const isBlocked = link.targetStatus === 'blocked' || link.targetStatus === 'not_started'
        const isActive = (link.sourceStatus === 'completed' || link.sourceStatus === 'in_progress') && !isBlocked
        const bridgeOpacity = isBlocked ? 0.35 : 0.85

        const sx = link.source.x, sy = link.source.y
        const tx = link.target.x, ty = link.target.y
        const dx = tx - sx, dy = ty - sy

        // Control point for quadratic bezier (slight organic curve)
        const cx = (sx + tx) / 2 + dy * 0.15
        const cy = (sy + ty) / 2 - dx * 0.15

        // Sample points along bezier, skip those inside milestone radii
        const dist = Math.sqrt(dx * dx + dy * dy)
        const numPoints = Math.max(3, Math.ceil(dist / BRIDGE_SPACING))
        const bridgePoints: { x: number; y: number }[] = []

        for (let j = 0; j <= numPoints; j++) {
          const t = j / numPoints
          const pt = bezierPoint(sx, sy, cx, cy, tx, ty, t)
          const dSrc = Math.sqrt((pt.x - sx) ** 2 + (pt.y - sy) ** 2)
          const dTgt = Math.sqrt((pt.x - tx) ** 2 + (pt.y - ty) ** 2)
          if (dSrc > link.source.radius && dTgt > link.target.radius) {
            bridgePoints.push(pt)
          }
        }

        // Pulse animation keyframe points (6 samples along bezier for smooth curve)
        const pulseKeyframes = isActive
          ? Array.from({ length: 6 }, (_, k) => bezierPoint(sx, sy, cx, cy, tx, ty, k / 5))
          : []

        return (
          <g key={i}>
            {/* Bridge circles — the goo filter merges these with milestones */}
            {bridgePoints.map((pt, j) => (
              <circle
                key={`b${j}`}
                cx={pt.x}
                cy={pt.y}
                r={BRIDGE_RADIUS}
                fill={color}
                fillOpacity={bridgeOpacity}
              />
            ))}

            {/* Pulse circles — animate along the bridge path */}
            {isActive && Array.from({ length: PULSE_COUNT }, (_, pi) => (
              <motion.circle
                key={`p${pi}`}
                r={PULSE_RADIUS}
                fill={color}
                fillOpacity={0.7}
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
    </g>
  )
}
