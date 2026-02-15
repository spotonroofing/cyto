import { useSettingsStore } from '@/stores/settingsStore'
import { useRoadmapStore, phases, milestones } from '@/stores/roadmapStore'
import { getPhaseColor, phaseNames } from '@/styles/theme'
import { calculateTimelineDates } from '@/utils/dependencyGraph'

interface MilestoneHeaderProps {
  milestoneId: string
}

export function MilestoneHeader({ milestoneId }: MilestoneHeaderProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getMilestoneProgress = useRoadmapStore((s) => s.getMilestoneProgress)
  const isDark = theme === 'dark'

  const milestone = milestones.find((m) => m.id === milestoneId)
  if (!milestone) return null

  const phase = phases.find((p) => p.id === milestone.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0
  const color = getPhaseColor(phaseIndex, isDark)
  const { completed, total, percentage } = getMilestoneProgress(milestoneId)

  // Calculate dynamic dates
  const allDates = calculateTimelineDates()
  const dates = allDates.find((d) => d.milestoneId === milestoneId)

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="rounded-blob p-6 mb-4"
      style={{
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        borderRadius: '24px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium opacity-60 uppercase tracking-wider">
          Phase {phaseIndex} — {phaseNames[phaseIndex]}
        </span>
      </div>

      <h2 className="font-display text-2xl font-bold mb-2">{milestone.title}</h2>
      <p className="text-sm opacity-70 mb-3">{milestone.description}</p>

      {/* Date range */}
      {dates && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono opacity-50">
            {formatDate(dates.expectedStart)} → {formatDate(dates.expectedEnd)}
          </span>
          {dates.delayDays > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-400/20 text-orange-500">
              +{dates.delayDays}d delayed
            </span>
          )}
          {dates.delayDays < 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/20 text-green-500">
              {Math.abs(dates.delayDays)}d ahead
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Progress circle */}
        <div className="relative w-12 h-12">
          <svg width={48} height={48} viewBox="0 0 48 48">
            <circle
              cx={24}
              cy={24}
              r={20}
              fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
              strokeWidth={3}
            />
            <circle
              cx={24}
              cy={24}
              r={20}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 20}
              strokeDashoffset={2 * Math.PI * 20 * (1 - percentage / 100)}
              transform="rotate(-90 24 24)"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-medium">
            {percentage}%
          </span>
        </div>

        <div className="text-sm font-mono opacity-60">
          {completed}/{total} items
        </div>
      </div>
    </div>
  )
}
