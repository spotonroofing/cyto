import { motion } from 'framer-motion'

interface FloatingButtonProps {
  onClick: () => void
  children: React.ReactNode
  className?: string
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right'
}

const positionClasses: Record<string, string> = {
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-right': 'top-6 right-6',
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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      onClick={onClick}
      className={`fixed ${positionClasses[position]} z-40 rounded-full px-5 py-2.5 font-medium text-sm shadow-lg backdrop-blur-sm ${className}`}
    >
      {children}
    </motion.button>
  )
}
