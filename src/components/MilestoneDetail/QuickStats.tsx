import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoadmapStore, phases, milestones } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import { SubDetailView } from './SubDetailView'

interface QuickStatsProps {
  milestoneId: string
}

export function QuickStats({ milestoneId }: QuickStatsProps) {
  const theme = useSettingsStore((s) => s.theme)
  const getActionItemsForMilestone = useRoadmapStore((s) => s.getActionItemsForMilestone)
  const isDark = theme === 'dark'
  const [expandedStat, setExpandedStat] = useState<string | null>(null)

  const items = getActionItemsForMilestone(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0
  const color = getPhaseColor(phaseIndex, isDark)

  // Generate phase-specific stats
  const stats = getStatsForMilestone(items, phaseIndex)

  if (stats.length === 0) return null

  return (
    <>
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <motion.button
              key={stat.label}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => stat.detail && setExpandedStat(stat.label)}
              className={`p-3 rounded-2xl text-center transition-colors ${
                stat.detail ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{ backgroundColor: `${color}15` }}
            >
              <div className="font-mono text-xl font-bold" style={{ color }}>
                {stat.value}
              </div>
              <div className="text-[11px] opacity-60 mt-1">{stat.label}</div>
              {stat.detail && (
                <div className="text-[9px] opacity-30 mt-0.5">tap to expand</div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Amoeba-split sub-detail views */}
      <AnimatePresence>
        {expandedStat && (
          <SubDetailView
            title={expandedStat}
            color={color}
            onClose={() => setExpandedStat(null)}
          >
            {getDetailContent(expandedStat, items, phaseIndex, isDark, color)}
          </SubDetailView>
        )}
      </AnimatePresence>
    </>
  )
}

interface Stat {
  label: string
  value: string
  detail?: boolean // whether this stat can be expanded via amoeba split
}

function getStatsForMilestone(
  items: { completed: boolean; category: string; foodTrial?: { outcome?: string; tier: number } }[],
  phaseIndex: number,
): Stat[] {
  const completed = items.filter((i) => i.completed).length
  const total = items.length

  const stats: Stat[] = [
    { label: 'Completed', value: `${completed}/${total}`, detail: true },
  ]

  if (phaseIndex === 2) {
    const meds = items.filter((i) => i.category === 'medication')
    const medsComplete = meds.filter((i) => i.completed).length
    stats.push({ label: 'Medications tracked', value: `${medsComplete}/${meds.length}`, detail: true })
  }

  if (phaseIndex === 4) {
    const foods = items.filter((i) => i.foodTrial)
    const passed = foods.filter((i) => i.foodTrial?.outcome === 'pass').length
    const failed = foods.filter((i) => i.foodTrial?.outcome === 'fail').length
    const tried = passed + failed
    stats.push(
      { label: 'Foods tried', value: `${tried}/${foods.length}`, detail: true },
      { label: 'Passed', value: `${passed}` },
      { label: 'Failed', value: `${failed}` },
    )
  }

  if (phaseIndex === 5) {
    const tests = items.filter((i) => i.category === 'test')
    stats.push({ label: 'Tests completed', value: `${tests.filter((i) => i.completed).length}/${tests.length}`, detail: true })
  }

  return stats
}

function getDetailContent(
  statLabel: string,
  items: { completed: boolean; title: string; category: string; foodTrial?: { outcome?: string; food: string; tier: number } }[],
  _phaseIndex: number,
  isDark: boolean,
  color: string,
): React.ReactNode {
  if (statLabel === 'Completed') {
    const completed = items.filter((i) => i.completed)
    const remaining = items.filter((i) => !i.completed)
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2 opacity-60">Remaining ({remaining.length})</h4>
          <div className="space-y-1">
            {remaining.map((item) => (
              <div key={item.title} className={`text-sm p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
                {item.title}
              </div>
            ))}
          </div>
        </div>
        {completed.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 opacity-60">Completed ({completed.length})</h4>
            <div className="space-y-1">
              {completed.map((item) => (
                <div key={item.title} className={`text-sm p-2 rounded-xl opacity-50 ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (statLabel === 'Foods tried') {
    const tiers = [1, 2, 3, 4]
    return (
      <div className="space-y-4">
        {tiers.map((tier) => {
          const tierItems = items.filter((i) => i.foodTrial?.tier === tier)
          if (tierItems.length === 0) return null
          return (
            <div key={tier}>
              <h4 className="text-sm font-medium mb-2" style={{ color }}>Tier {tier}</h4>
              <div className="grid grid-cols-2 gap-2">
                {tierItems.map((item) => (
                  <div
                    key={item.title}
                    className={`text-xs p-2 rounded-xl text-center ${
                      item.foodTrial?.outcome === 'pass'
                        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                        : item.foodTrial?.outcome === 'fail'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : isDark ? 'bg-white/5' : 'bg-black/[0.03]'
                    }`}
                  >
                    {item.foodTrial?.food ?? item.title}
                    {item.foodTrial?.outcome && (
                      <span className="block text-[10px] opacity-60 mt-0.5">
                        {item.foodTrial.outcome}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Default: show category breakdown
  const byCategory = new Map<string, { completed: number; total: number }>()
  for (const item of items) {
    const cat = item.category
    const existing = byCategory.get(cat) ?? { completed: 0, total: 0 }
    existing.total++
    if (item.completed) existing.completed++
    byCategory.set(cat, existing)
  }

  return (
    <div className="space-y-2">
      {Array.from(byCategory.entries()).map(([cat, data]) => (
        <div key={cat} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
          <span className="text-sm capitalize">{cat}</span>
          <span className="text-sm font-mono" style={{ color }}>
            {data.completed}/{data.total}
          </span>
        </div>
      ))}
    </div>
  )
}
