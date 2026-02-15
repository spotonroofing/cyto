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
  const openChat = useUIStore((s) => s.openChat)
  const isDark = theme === 'dark'

  const handleClose = () => selectMilestone(null)

  return (
    <>
      {/* Backdrop (desktop: map visible behind at reduced opacity) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-30"
        style={{ backgroundColor: isDark ? 'rgba(15,14,23,0.7)' : 'rgba(255,248,240,0.7)' }}
        onClick={handleClose}
      />

      {/* Detail panel */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
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
            <button
              onClick={handleClose}
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
            </button>
          </div>

          <MilestoneHeader milestoneId={milestoneId} />
          <QuickStats milestoneId={milestoneId} />
          <Checklist milestoneId={milestoneId} />
          <div className="mt-6">
            <NotesLog milestoneId={milestoneId} />
          </div>
        </div>

        {/* cyto chat entry point (Spec 4.1) */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
          onClick={() => openChat(milestoneId)}
          className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
            isDark ? 'bg-copper/30 hover:bg-copper/40' : 'bg-gold/30 hover:bg-gold/40'
          }`}
        >
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
            <path
              d="M3 10C3 6.134 6.134 3 10 3C13.866 3 17 6.134 17 10C17 13.866 13.866 17 10 17C8.8 17 7.67 16.7 6.67 16.17L3 17L3.83 13.33C3.3 12.33 3 11.2 3 10Z"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </motion.div>
    </>
  )
}
