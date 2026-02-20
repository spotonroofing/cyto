import { motion } from 'framer-motion'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'
import { phases, milestones } from '@/stores/roadmapStore'
import type { ActionItem } from '@/types'

interface ChecklistProps {
  milestoneId: string
}

export function Checklist({ milestoneId }: ChecklistProps) {
  const { palette, phaseColor, isDark } = useTheme()
  const getActionItemsForMilestone = useRoadmapStore((s) => s.getActionItemsForMilestone)
  const toggleActionItem = useRoadmapStore((s) => s.toggleActionItem)
  const setFoodTrialOutcome = useRoadmapStore((s) => s.setFoodTrialOutcome)

  const items = getActionItemsForMilestone(milestoneId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0
  const color = phaseColor(phaseIndex)

  // Sort: uncompleted first, then completed
  const sortedItems = [...items].sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })

  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg font-semibold mb-3">Action Items</h3>
      {sortedItems.map((item, index) => (
        <ChecklistItem
          key={item.id}
          item={item}
          color={color}
          isDark={isDark}
          doneColor={palette.done}
          bgColor={palette.bg}
          index={index}
          onToggle={() => toggleActionItem(item.id)}
          onFoodTrialOutcome={(outcome) => setFoodTrialOutcome(item.id, outcome)}
        />
      ))}
    </div>
  )
}

interface ChecklistItemProps {
  item: ActionItem
  color: string
  isDark: boolean
  doneColor: string
  bgColor: string
  index: number
  onToggle: () => void
  onFoodTrialOutcome: (outcome: 'pass' | 'fail') => void
}

function ChecklistItem({ item, color, isDark, doneColor, bgColor, index, onToggle, onFoodTrialOutcome }: ChecklistItemProps) {
  const isFoodTrial = !!item.foodTrial

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 200, damping: 25 }}
      className={`flex items-start gap-3 p-3 rounded-2xl transition-colors ${
        item.completed
          ? 'opacity-50'
          : isDark
            ? 'bg-white/5'
            : 'bg-black/[0.03]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: item.completed ? doneColor : color,
          backgroundColor: item.completed ? doneColor : 'transparent',
        }}
      >
        {item.completed && (
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4.5 7.5L8 2.5"
              stroke={bgColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            item.completed ? 'line-through opacity-70' : ''
          }`}
        >
          {item.title}
        </p>

        {/* Category badge */}
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider opacity-50"
          style={{ backgroundColor: `${color}20` }}
        >
          {item.category}
        </span>

        {/* Completion date */}
        {item.completed && item.completedDate && (
          <span className="block mt-1 text-[10px] font-mono opacity-40">
            Completed {item.completedDate}
          </span>
        )}

        {/* Food trial outcome buttons */}
        {isFoodTrial && item.completed && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onFoodTrialOutcome('pass') }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                item.foodTrial?.outcome === 'pass'
                  ? 'bg-green-500/30 text-green-700 dark:text-green-300'
                  : 'bg-green-500/10 text-green-600/60 dark:text-green-400/60'
              }`}
            >
              Pass
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onFoodTrialOutcome('fail') }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                item.foodTrial?.outcome === 'fail'
                  ? 'bg-red-500/30 text-red-700 dark:text-red-300'
                  : 'bg-red-500/10 text-red-600/60 dark:text-red-400/60'
              }`}
            >
              Fail
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
