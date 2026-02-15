import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'

export function TypingIndicator() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const dotColor = isDark ? '#C49A6C' : '#D4A574'

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
