import { useRoadmapStore, phases } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor, phaseNames } from '@/styles/theme'

export function MilestoneProgress() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const getOverallProgress = useRoadmapStore((s) => s.getOverallProgress)
  const getPhaseProgress = useRoadmapStore((s) => s.getPhaseProgress)

  const overall = getOverallProgress()

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Milestone Progress</h3>

      {/* Overall */}
      <div className={`p-4 rounded-2xl mb-3 ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall</span>
          <span className="font-mono text-sm font-bold">{overall.percentage}%</span>
        </div>
        <div className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overall.percentage}%`,
              background: 'linear-gradient(90deg, #FFB5A7, #D8BBFF, #B8F3D4, #A2D2FF)',
            }}
          />
        </div>
        <div className="text-[10px] font-mono opacity-40 mt-1">
          {overall.completed}/{overall.total} items
        </div>
      </div>

      {/* Per-phase */}
      <div className="space-y-2">
        {phases.map((phase, index) => {
          const progress = getPhaseProgress(phase.id)
          const color = getPhaseColor(index, isDark)
          return (
            <div key={phase.id} className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs flex-1 truncate">
                {phaseNames[index]}
              </span>
              <div className={`w-20 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-[10px] font-mono opacity-40 w-8 text-right">
                {progress.percentage}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
