import { motion } from 'framer-motion'
import { MilestoneHeader } from './MilestoneHeader'
import { Checklist } from './Checklist'
import { QuickStats } from './QuickStats'
import { NotesLog } from './NotesLog'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface MilestoneDetailProps {
  milestoneId: string
}

export function MilestoneDetail({ milestoneId }: MilestoneDetailProps) {
  const theme = useSettingsStore((s) => s.theme)
  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const isDark = theme === 'dark'

  const handleClose = () => selectMilestone(null)

  return (
    <>
      {/* Backdrop (desktop: map visible behind at reduced opacity) */}
      <div
        className="fixed inset-0 z-30"
        style={{ backgroundColor: isDark ? 'rgba(15,14,23,0.7)' : 'rgba(255,248,240,0.7)' }}
        onClick={handleClose}
      />

      {/* Detail panel */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          opacity: { type: 'spring', stiffness: 150, damping: 20 },
          y: { type: 'spring', stiffness: 150, damping: 20 },
        }}
        className={`fixed z-40 overflow-y-auto overscroll-contain ${
          // Mobile: full screen. Desktop: centered 70-80% viewport
          'inset-0 md:inset-auto md:top-[10%] md:left-[10%] md:right-[10%] md:bottom-[10%]'
        } ${
          isDark ? 'bg-navy/95' : 'bg-cream/95'
        } backdrop-blur-xl md:rounded-[32px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 max-w-2xl mx-auto pb-24">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <motion.button
              onClick={handleClose}
              whileHover={{ rotate: 90 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
            </motion.button>
          </div>

          <MilestoneHeader milestoneId={milestoneId} />
          <QuickStats milestoneId={milestoneId} />
          <Checklist milestoneId={milestoneId} />
          <div className="mt-6">
            <NotesLog milestoneId={milestoneId} />
          </div>
        </div>
      </motion.div>
    </>
  )
}
