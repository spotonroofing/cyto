import { motion } from 'framer-motion'
import { useRef } from 'react'

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
  const bobRef = useRef({ delay: Math.random() * 2 })

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: [0, -2, 0],
      }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: bobRef.current.delay },
        scale: { type: 'spring', stiffness: 200, damping: 20 },
        opacity: { duration: 0.3 },
      }}
      onClick={onClick}
      className={`${position === 'inline' ? '' : 'fixed'} ${positionClasses[position]} z-40 rounded-full px-5 py-2.5 font-medium text-sm
        bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/30 dark:border-white/10
        shadow-sm hover:bg-white/80 dark:hover:bg-white/15
        text-charcoal dark:text-softwhite ${className}`}
    >
      {children}
    </motion.button>
  )
}
