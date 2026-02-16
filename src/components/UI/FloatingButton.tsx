import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'

interface FloatingButtonProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'inline'
  phaseColor?: string
}

const positionClasses: Record<string, string> = {
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-right': 'top-6 right-6',
  'inline': '',
}

export function FloatingButton({
  onClick,
  children,
  className = '',
  position = 'bottom-center',
  phaseColor,
}: FloatingButtonProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const color = phaseColor ?? (isDark ? '#D4967E' : '#FCD5CE')

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{
        scale: { type: 'spring', stiffness: 200, damping: 20 },
        opacity: { duration: 0.3 },
      }}
      onClick={onClick}
      className={`${position === 'inline' ? '' : 'fixed'} ${positionClasses[position]} z-40
        rounded-full relative overflow-hidden
        text-charcoal/70 dark:text-softwhite/70 ${className}`}
    >
      {/* Membrane layer */}
      <span
        className="absolute inset-0 rounded-full membrane-breathe"
        style={{ backgroundColor: color, opacity: 0.2 }}
      />
      {/* Nucleus layer */}
      <span
        className="absolute rounded-full"
        style={{ backgroundColor: color, opacity: 0.45, inset: '15%' }}
      />
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center w-full h-full">
        {children}
      </span>
    </motion.button>
  )
}
