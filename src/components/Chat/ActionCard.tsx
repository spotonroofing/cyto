import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import type { RoadmapAction } from '@/types'

interface ActionCardProps {
  action: RoadmapAction
  onApply: () => void
  onDismiss: () => void
}

const actionLabels: Record<string, string> = {
  add_item: 'Add item',
  remove_item: 'Remove item',
  complete_item: 'Mark complete',
  update_date: 'Update date',
  add_note: 'Add note',
}

export function ActionCard({ action, onApply, onDismiss }: ActionCardProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-4 my-2 p-4 rounded-2xl border ${
        isDark
          ? 'bg-copper/10 border-copper/20'
          : 'bg-gold/10 border-gold/20'
      }`}
    >
      <div className="text-xs font-medium opacity-60 mb-1">cyto wants to:</div>
      <div className="text-sm font-medium mb-1">
        {actionLabels[action.action] ?? action.action}
      </div>
      <div className="text-xs font-mono opacity-50 mb-3">
        Target: {action.target}
        {action.data && Object.keys(action.data).length > 0 && (
          <span> | Data: {JSON.stringify(action.data)}</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApply}
          className={`px-4 py-1.5 rounded-full text-xs font-medium ${
            isDark ? 'bg-copper/30 hover:bg-copper/40' : 'bg-gold/30 hover:bg-gold/40'
          }`}
        >
          Apply
        </button>
        <button
          onClick={onDismiss}
          className={`px-4 py-1.5 rounded-full text-xs font-medium opacity-50 hover:opacity-70 ${
            isDark ? 'bg-white/5' : 'bg-black/5'
          }`}
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}
