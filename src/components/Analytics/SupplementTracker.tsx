import { useRoadmapStore } from '@/stores/roadmapStore'
import { actionItems } from '@/data/roadmap'
import { useSettingsStore } from '@/stores/settingsStore'

export function SupplementTracker() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const getActionItem = useRoadmapStore((s) => s.getActionItem)

  // Count active supplements (supplement category items that are not completed/tapered)
  const supplementItems = actionItems.filter((a) => a.category === 'supplement')
  const activeSupplements = supplementItems.filter((a) => {
    const item = getActionItem(a.id)
    // If it's a "taper" item and completed, it reduces count
    // If it's a "start" item and not completed, it's not yet active
    if (a.title.toLowerCase().includes('taper') || a.title.toLowerCase().includes('discontinue')) {
      return !item.completed // Still active if not yet tapered
    }
    return item.completed || a.phaseId === 'phase-0' || a.phaseId === 'phase-2'
  })

  const count = activeSupplements.length

  // cyto voice (Spec 7.2.5)
  const quip = count >= 15
    ? `Your daily supplement haul: ${count} items. You're basically a pharmacy.`
    : count >= 10
      ? `${count} supplements on the roster. Your kitchen counter weeps.`
      : count >= 5
        ? `${count} supplements currently active. Solid stack.`
        : `${count} supplements. Minimalist vibes.`

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Supplement Count</h3>

      <div className={`p-4 rounded-2xl text-center ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
        <div className="font-mono text-4xl font-bold mb-2" style={{ color: isDark ? '#C49A6C' : '#D4A574' }}>
          {count}
        </div>
        <p className="text-xs opacity-50 italic">{quip}</p>
      </div>
    </div>
  )
}
