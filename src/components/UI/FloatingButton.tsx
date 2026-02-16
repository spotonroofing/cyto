import { motion } from 'framer-motion'

interface FloatingButtonProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'inline'
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
}: FloatingButtonProps) {
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
      className={`${position === 'inline' ? '' : 'fixed'} ${positionClasses[position]} z-40 font-medium text-sm
        membrane-breathe
        bg-[#FFE8E4]/60 dark:bg-white/10 backdrop-blur-md
        border border-[#FFCFC8]/30 dark:border-white/10
        shadow-sm hover:bg-[#FFE8E4]/80 dark:hover:bg-white/15
        text-charcoal dark:text-softwhite ${className}`}
    >
      {children}
    </motion.button>
  )
}
