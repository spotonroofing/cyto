import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDailyLogStore, createEmptyLog } from '@/stores/dailyLogStore'
import { useHealthDataStore } from '@/stores/healthDataStore'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

interface QuickLogModalProps {
  onClose: () => void
  onOpenFull: () => void
}

export function QuickLogModal({ onClose, onOpenFull }: QuickLogModalProps) {
  const { palette, phaseColor, isDark } = useTheme()
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const saveLog = useDailyLogStore((s) => s.saveLog)
  const { sleep, weight, fetchSleepRange, fetchWeightRange } = useHealthDataStore()

  const today = new Date().toISOString().split('T')[0]!
  const [log, setLog] = useState<DailyLog>(() => getLogForDate(today) ?? createEmptyLog(today))
  const [showSuccess, setShowSuccess] = useState(false)

  // Fetch today's health data on mount
  useEffect(() => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!
    fetchSleepRange(yesterday, today)
    fetchWeightRange(yesterday, today)
  }, [today, fetchSleepRange, fetchWeightRange])

  // Auto-populate sleep quality from Apple Health duration (if not already set)
  useEffect(() => {
    if (log.sleep > 0 && log.sleep !== 5) return // Already set by user
    
    const todaySleep = sleep.find((s) => s.sleep_end.startsWith(today))
    if (todaySleep && todaySleep.duration_hours) {
      // Convert sleep duration to quality score (1-10)
      // 4 hrs = 2, 6 hrs = 5, 8 hrs = 8, 9+ hrs = 10
      const hours = todaySleep.duration_hours
      let quality = 5
      if (hours < 4) quality = 2
      else if (hours < 6) quality = Math.round(2 + (hours - 4) * 1.5)
      else if (hours < 8) quality = Math.round(5 + (hours - 6) * 1.5)
      else if (hours < 9) quality = 8
      else quality = Math.min(10, Math.round(8 + (hours - 9) * 2))
      
      setLog((prev) => ({ ...prev, sleep: quality }))
    }
  }, [sleep, today, log.sleep])

  // Auto-populate weight from Apple Health (if not already set)
  useEffect(() => {
    if (log.weight) return // Already set by user
    
    const todayWeight = weight.find((w) => w.date.startsWith(today))
    if (todayWeight) {
      setLog((prev) => ({ ...prev, weight: todayWeight.weight_lbs }))
    }
  }, [weight, today, log.weight])

  const update = (partial: Partial<DailyLog>) => {
    setLog((prev) => ({ ...prev, ...partial, date: today }))
  }

  const handleSave = useCallback(async () => {
    await saveLog(log)
    setShowSuccess(true)
    setTimeout(() => {
      onClose()
    }, 800)
  }, [log, saveLog, onClose])

  const handleAddDetails = () => {
    saveLog(log) // Save current state first
    onOpenFull() // Open full panel
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: palette.backdrop }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="fixed z-50 backdrop-blur-xl rounded-[24px] shadow-2xl"
        style={{
          backgroundColor: palette.surface + 'F8',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(90vw, 360px)',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-xl font-bold">Quick Log</h2>
              <p className="text-xs opacity-50 mt-0.5">How are you feeling today?</p>
            </div>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
            >
              <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Quick sliders - larger, more touch-friendly */}
          <div className="space-y-5 mb-5">
            <QuickSlider
              label="Energy"
              value={log.energy}
              onChange={(v) => update({ energy: v })}
              color={phaseColor(0)}
            />
            <QuickSlider
              label="Brain Fog"
              value={log.fog}
              onChange={(v) => update({ fog: v })}
              color={phaseColor(2)}
            />
            <QuickSlider
              label="Mood"
              value={log.mood}
              onChange={(v) => update({ mood: v })}
              color={phaseColor(1)}
            />
          </div>

          {/* Flare quick toggle */}
          <div className="mb-5">
            <button
              onClick={() => update({ flare: !log.flare })}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                log.flare
                  ? 'bg-red-500/20 text-red-400'
                  : isDark
                  ? 'bg-white/5 hover:bg-white/8'
                  : 'bg-black/5 hover:bg-black/8'
              }`}
            >
              {log.flare ? '🔥 Flare today' : 'No flare'}
            </button>
          </div>

          {/* Smart data indicators (if auto-populated) */}
          {(log.sleep > 0 || log.weight) && (
            <div className="mb-5 p-3 rounded-xl text-xs" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
              <div className="opacity-50 mb-1.5">Auto-populated from Apple Health:</div>
              <div className="flex gap-3">
                {log.sleep > 0 && (
                  <div>
                    <span className="opacity-70">Sleep quality: </span>
                    <span className="font-mono" style={{ color: phaseColor(5) }}>{log.sleep}/10</span>
                  </div>
                )}
                {log.weight && (
                  <div>
                    <span className="opacity-70">Weight: </span>
                    <span className="font-mono">{Math.round(log.weight)} lbs</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <AnimatePresence mode="wait">
            {!showSuccess ? (
              <motion.div
                key="actions"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-2"
              >
                <button
                  onClick={handleAddDetails}
                  className={`flex-1 py-3 rounded-xl font-medium text-sm ${
                    isDark ? 'bg-white/5 hover:bg-white/8' : 'bg-black/5 hover:bg-black/8'
                  }`}
                >
                  Add details
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl font-medium text-sm"
                  style={{ backgroundColor: phaseColor(0) + '30', color: phaseColor(0) }}
                >
                  Save
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center py-3"
              >
                <div className="flex items-center gap-2" style={{ color: phaseColor(0) }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="font-medium">Logged!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}

// Simplified slider component for quick log
function QuickSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-mono font-bold" style={{ color }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color}40 0%, ${color}40 ${((value - 1) / 9) * 100}%, rgba(255,255,255,0.05) ${((value - 1) / 9) * 100}%, rgba(255,255,255,0.05) 100%)`,
        }}
      />
    </div>
  )
}
