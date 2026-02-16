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
      className={`${position === 'inline' ? '' : 'fixed'} ${positionClasses[position]} z-40
        membrane-breathe
        text-charcoal/70 dark:text-softwhite/70 ${className}`}
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(255,245,243,0.85) 50%, rgba(255,228,224,0.35) 100%)',
        boxShadow: '0 0 0 1.5px rgba(255,200,190,0.25), 0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </motion.button>
  )
}
