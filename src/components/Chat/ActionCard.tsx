import { motion } from 'framer-motion'
import { useTheme } from '@/themes'
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
  const { palette } = useTheme()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 my-2 p-4 rounded-2xl border"
      style={{
        backgroundColor: palette.accent + '1A',
        borderColor: palette.accent + '33',
      }}
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
          className="px-4 py-1.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: palette.accent + '4D' }}
        >
          Apply
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 rounded-full text-xs font-medium opacity-50 hover:opacity-70"
          style={{ backgroundColor: palette.border }}
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  )
}
