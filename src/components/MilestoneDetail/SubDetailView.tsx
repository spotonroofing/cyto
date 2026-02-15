import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'

interface SubDetailViewProps {
  title: string
  color: string
  onClose: () => void
  children: React.ReactNode
}

export function SubDetailView({ title, color, onClose, children }: SubDetailViewProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  return (
    <motion.div
      initial={{
        scale: 0.3,
        opacity: 0,
        borderRadius: '50%',
      }}
      animate={{
        scale: 1,
        opacity: 1,
        borderRadius: '24px',
      }}
      exit={{
        scale: 0.3,
        opacity: 0,
        borderRadius: '50%',
      }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 18,
      }}
      className={`fixed inset-x-4 top-24 bottom-24 z-50
        md:inset-auto md:top-[15%] md:left-[15%] md:right-[15%] md:bottom-[15%]
        overflow-y-auto overscroll-contain shadow-2xl
        ${isDark ? 'bg-navy/95' : 'bg-cream/95'} backdrop-blur-xl`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Amoeba membrane effect - colored border */}
      <div
        className="absolute inset-0 rounded-[24px] pointer-events-none membrane-breathe"
        style={{
          border: `2px solid ${color}40`,
          boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}10`,
        }}
      />

      <div className="p-6 relative">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
            }`}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="font-display text-lg font-bold">{title}</h3>
        </div>

        {children}
      </div>
    </motion.div>
  )
}
