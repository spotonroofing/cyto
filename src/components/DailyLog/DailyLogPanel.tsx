import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { LogSlider } from './LogSlider'
import { FlareToggle } from './FlareToggle'
import { FoodInput } from './FoodInput'
import { DateSelector } from './DateSelector'
import { useDailyLogStore, createEmptyLog } from '@/stores/dailyLogStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { DailyLog } from '@/types'

interface DailyLogPanelProps {
  onClose: () => void
}

export function DailyLogPanel({ onClose }: DailyLogPanelProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const saveLog = useDailyLogStore((s) => s.saveLog)

  const today = new Date().toISOString().split('T')[0]!
  const [selectedDate, setSelectedDate] = useState(today)
  const [log, setLog] = useState<DailyLog>(() => getLogForDate(today) ?? createEmptyLog(today))

  // Load log when date changes
  useEffect(() => {
    const existing = getLogForDate(selectedDate)
    setLog(existing ?? createEmptyLog(selectedDate))
  }, [selectedDate, getLogForDate])

  // Auto-save on changes (Spec 6.2: auto-saves as user inputs, no submit button)
  const autoSave = useCallback(
    (updatedLog: DailyLog) => {
      setLog(updatedLog)
      saveLog(updatedLog)
    },
    [saveLog],
  )

  const update = (partial: Partial<DailyLog>) => {
    autoSave({ ...log, ...partial, date: selectedDate })
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-30"
        style={{ backgroundColor: isDark ? 'rgba(15,14,23,0.5)' : 'rgba(255,248,240,0.5)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
        className={`fixed z-40 overflow-y-auto overscroll-contain
          inset-x-4 bottom-4 top-20
          md:inset-auto md:bottom-8 md:right-8 md:w-96 md:max-h-[80vh]
          ${isDark ? 'bg-navy/95' : 'bg-cream/95'}
          backdrop-blur-xl rounded-[28px] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Daily Log</h2>
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

          <DateSelector date={selectedDate} onChange={setSelectedDate} />

          <LogSlider
            label="Energy"
            value={log.energy}
            onChange={(v) => update({ energy: v })}
            color="#FFB5A7"
          />
          <LogSlider
            label="Brain Fog"
            value={log.fog}
            onChange={(v) => update({ fog: v })}
            color="#D8BBFF"
          />
          <LogSlider
            label="Mood"
            value={log.mood}
            onChange={(v) => update({ mood: v })}
            color="#FFAFCC"
          />
          <LogSlider
            label="Sleep Quality"
            value={log.sleep}
            onChange={(v) => update({ sleep: v })}
            color="#A2D2FF"
          />

          <FlareToggle
            flare={log.flare}
            severity={log.flareSeverity}
            trigger={log.flareTrigger}
            onFlareChange={(v) => update({ flare: v })}
            onSeverityChange={(v) => update({ flareSeverity: v })}
            onTriggerChange={(v) => update({ flareTrigger: v })}
          />

          {/* Weight */}
          <div className="mb-4">
            <span className="text-sm font-medium block mb-2">Weight (lbs)</span>
            <input
              type="number"
              value={log.weight ?? ''}
              onChange={(e) => update({ weight: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="e.g. 145"
              className={`w-full px-3 py-1.5 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/5 focus:ring-copper/30 placeholder:text-white/20'
                  : 'bg-black/[0.03] focus:ring-gold/30 placeholder:text-black/20'
              }`}
            />
          </div>

          <FoodInput foods={log.foods} onChange={(foods) => update({ foods })} />

          {/* Notes */}
          <div className="mb-4">
            <span className="text-sm font-medium block mb-2">Notes</span>
            <textarea
              value={log.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Anything to note about today..."
              rows={3}
              className={`w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/5 focus:ring-copper/30 placeholder:text-white/20'
                  : 'bg-black/[0.03] focus:ring-gold/30 placeholder:text-black/20'
              }`}
            />
          </div>

          {/* Auto-save indicator */}
          <div className="text-center">
            <span className="text-[10px] font-mono opacity-30">Auto-saved</span>
          </div>
        </div>
      </motion.div>
    </>
  )
}
