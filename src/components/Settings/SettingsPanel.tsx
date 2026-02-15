import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useChatStore } from '@/stores/chatStore'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { defaultHealthContext } from '@/data/healthContext'
import { db } from '@/lib/db'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey)
  const setAnthropicApiKey = useSettingsStore((s) => s.setAnthropicApiKey)
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const setProtocolStartDate = useSettingsStore((s) => s.setProtocolStartDate)
  const healthContext = useSettingsStore((s) => s.healthContext)
  const setHealthContext = useSettingsStore((s) => s.setHealthContext)
  const isDark = theme === 'dark'

  const [showApiKey, setShowApiKey] = useState(false)
  const [editingContext, setEditingContext] = useState(false)
  const [contextDraft, setContextDraft] = useState(healthContext ?? defaultHealthContext)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Export all data as JSON
  const handleExport = async () => {
    const dailyLogs = await db.dailyLogs.toArray()
    const chatMessages = await db.chatMessages.toArray()
    const actionItemStates = await db.actionItemStates.toArray()
    const milestoneNotes = await db.milestoneNotes.toArray()

    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      settings: {
        theme,
        protocolStartDate,
        healthContext: healthContext ?? defaultHealthContext,
      },
      dailyLogs,
      chatMessages,
      actionItemStates,
      milestoneNotes,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cyto-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import data from JSON
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.dailyLogs) await db.dailyLogs.bulkPut(data.dailyLogs)
        if (data.chatMessages) await db.chatMessages.bulkPut(data.chatMessages)
        if (data.actionItemStates) await db.actionItemStates.bulkPut(data.actionItemStates)
        if (data.milestoneNotes) await db.milestoneNotes.bulkPut(data.milestoneNotes)
        if (data.settings?.healthContext) setHealthContext(data.settings.healthContext)
        if (data.settings?.protocolStartDate) setProtocolStartDate(data.settings.protocolStartDate)
        // Reinitialize stores
        await useRoadmapStore.getState().initialize()
        await useDailyLogStore.getState().initialize()
        await useChatStore.getState().initialize()
        alert('Data imported successfully')
      } catch {
        alert('Failed to import data — invalid file')
      }
    }
    input.click()
  }

  // Nuclear reset
  const handleReset = async () => {
    await db.dailyLogs.clear()
    await db.chatMessages.clear()
    await db.actionItemStates.clear()
    await db.milestoneNotes.clear()
    localStorage.removeItem('cyto-settings')
    window.location.reload()
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
        initial={{ scale: 0.8, opacity: 0, y: -30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -30 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
        className={`fixed z-40 overflow-y-auto overscroll-contain
          inset-x-4 top-16 bottom-16
          md:inset-auto md:top-16 md:right-8 md:w-96 md:max-h-[80vh]
          ${isDark ? 'bg-navy/95' : 'bg-cream/95'}
          backdrop-blur-xl rounded-[28px] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold">Settings</h2>
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

          {/* Theme toggle */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-medium">Theme</span>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isDark ? 'bg-copper/30' : 'bg-gold/30'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full transition-transform shadow-sm flex items-center justify-center text-[10px] ${
                  isDark
                    ? 'translate-x-7 bg-navy text-softwhite'
                    : 'translate-x-0.5 bg-cream text-charcoal'
                }`}
              >
                {isDark ? '🌙' : '☀'}
              </span>
            </button>
          </div>

          {/* Protocol start date */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Protocol Start Date</label>
            <input
              type="date"
              value={protocolStartDate}
              onChange={(e) => setProtocolStartDate(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/5 focus:ring-copper/30 text-softwhite'
                  : 'bg-black/[0.03] focus:ring-gold/30 text-charcoal'
              }`}
            />
          </div>

          {/* API Key */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Anthropic API Key</label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-white/5 focus:ring-copper/30 placeholder:text-white/20'
                    : 'bg-black/[0.03] focus:ring-gold/30 placeholder:text-black/20'
                }`}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={`px-3 py-2 rounded-xl text-xs ${
                  isDark ? 'bg-white/5' : 'bg-black/[0.03]'
                }`}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Health context editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Health Context</label>
              <button
                onClick={() => setEditingContext(!editingContext)}
                className="text-xs opacity-50 hover:opacity-70"
              >
                {editingContext ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingContext ? (
              <div>
                <textarea
                  value={contextDraft}
                  onChange={(e) => setContextDraft(e.target.value)}
                  rows={10}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono resize-none focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-white/5 focus:ring-copper/30'
                      : 'bg-black/[0.03] focus:ring-gold/30'
                  }`}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setHealthContext(contextDraft)
                      setEditingContext(false)
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                      isDark ? 'bg-copper/20' : 'bg-gold/20'
                    }`}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setContextDraft(defaultHealthContext)
                      setHealthContext(null)
                      setEditingContext(false)
                    }}
                    className="px-4 py-1.5 rounded-full text-xs opacity-50"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            ) : (
              <div className={`p-3 rounded-xl text-[10px] font-mono leading-relaxed max-h-32 overflow-y-auto ${
                isDark ? 'bg-white/5' : 'bg-black/[0.03]'
              }`}>
                {(healthContext ?? defaultHealthContext).slice(0, 200)}...
              </div>
            )}
          </div>

          {/* Data export/import */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Data</label>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className={`flex-1 px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? 'bg-copper/20 hover:bg-copper/30' : 'bg-gold/20 hover:bg-gold/30'
                }`}
              >
                Export JSON
              </button>
              <button
                onClick={handleImport}
                className={`flex-1 px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/[0.03] hover:bg-black/[0.06]'
                }`}
              >
                Import JSON
              </button>
            </div>
          </div>

          {/* Reset */}
          <div>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full px-4 py-2 rounded-xl text-xs font-medium text-red-500/60 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                Reset All Data
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-500 mb-3">
                  This will permanently delete all your data. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  >
                    Yes, reset everything
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-1.5 rounded-full text-xs opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
