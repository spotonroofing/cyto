import { motion } from 'framer-motion'
import { TrendChart } from './TrendChart'
import { WeightChart } from './WeightChart'
import { FoodToleranceChart } from './FoodToleranceChart'
import { FlareCalendar } from './FlareCalendar'
import { MilestoneProgress } from './MilestoneProgress'
import { SupplementTracker } from './SupplementTracker'
import { useTheme } from '@/themes'

interface AnalyticsDashboardProps {
  onClose: () => void
}

export function AnalyticsDashboard({ onClose }: AnalyticsDashboardProps) {
  const { palette, isDark } = useTheme()

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-30"
        style={{ backgroundColor: palette.backdrop }}
        onClick={onClose}
      />

      {/* Dashboard */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
        className="fixed inset-0 z-40 overflow-y-auto overscroll-contain backdrop-blur-xl"
        style={{ backgroundColor: palette.surface + 'FA' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto p-6 pb-20">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold">Analytics</h2>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Charts grid — single column on mobile, two on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full-width trend chart */}
            <div className={`col-span-1 md:col-span-2 p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <TrendChart />
            </div>

            <div className={`p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <WeightChart />
            </div>

            <div className={`p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <FoodToleranceChart />
            </div>

            <div className={`p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <FlareCalendar />
            </div>

            <div className={`p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <MilestoneProgress />
            </div>

            <div className={`col-span-1 md:col-span-2 p-5 rounded-[24px] ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
              <SupplementTracker />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
