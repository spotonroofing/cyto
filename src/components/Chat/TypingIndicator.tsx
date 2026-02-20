import { motion } from 'framer-motion'
import { useTheme } from '@/themes'

export function TypingIndicator() {
  const { palette, isDark } = useTheme()
  const dotColor = palette.accent

  return (
    <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-2xl ${
      isDark ? 'bg-white/5' : 'bg-black/[0.03]'
    }`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
