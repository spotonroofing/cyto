import { useEffect, useState, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeProvider } from '@/components/UI/ThemeProvider'
import { useSettingsStore } from '@/stores/settingsStore'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { BubbleMap } from '@/components/BubbleMap/BubbleMap'
import { FloatingButton } from '@/components/UI/FloatingButton'
import { GooTuningPanel } from '@/components/UI/GooTuningPanel'
import { TypewriterTerminal } from '@/components/UI/TypewriterTerminal'
import { CellColonyStrip } from '@/components/CellColony/CellColonyStrip'
import { useTheme } from '@/themes'

// Lazy-loaded overlays (not needed on initial render)
const MilestoneDetail = lazy(() => import('@/components/MilestoneDetail/MilestoneDetail').then((m) => ({ default: m.MilestoneDetail })))
const DailyLogPanel = lazy(() => import('@/components/DailyLog/DailyLogPanel').then((m) => ({ default: m.DailyLogPanel })))
const AnalyticsDashboard = lazy(() => import('@/components/Analytics/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })))
const ChatPanel = lazy(() => import('@/components/Chat/ChatPanel').then((m) => ({ default: m.ChatPanel })))
const SettingsPanel = lazy(() => import('@/components/Settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })))

export function App() {
  const theme = useSettingsStore((s) => s.theme)
  const { phaseColor, palette } = useTheme()

  const selectedMilestoneId = useUIStore((s) => s.selectedMilestoneId)
  const isLogOpen = useUIStore((s) => s.isLogOpen)
  const isAnalyticsOpen = useUIStore((s) => s.isAnalyticsOpen)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const toggleLog = useUIStore((s) => s.toggleLog) // TODO: Re-enable daily log FAB button
  void toggleLog
  const closeLog = useUIStore((s) => s.closeLog)
  const toggleAnalytics = useUIStore((s) => s.toggleAnalytics)
  const closeAnalytics = useUIStore((s) => s.closeAnalytics)
  const openChat = useUIStore((s) => s.openChat)
  const closeChat = useUIStore((s) => s.closeChat)
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen)
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [ready, setReady] = useState(false)
  const [recenterMode, setRecenterMode] = useState<'focus' | 'fit-all'>('focus')

  useEffect(() => {
    Promise.all([
      useRoadmapStore.getState().initialize(),
      useDailyLogStore.getState().initialize(),
      useChatStore.getState().initialize(),
    ]).then(() => setReady(true))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setRecenterMode(detail)
    }
    window.addEventListener('cyto-recenter-mode', handler)
    return () => window.removeEventListener('cyto-recenter-mode', handler)
  }, [])

  if (!ready) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-animated-dark' : 'bg-animated-light'
      }`}>
        <div className="font-display text-2xl opacity-60" style={{ color: palette.text }}>
          Loading...
        </div>
      </div>
    )
  }

  // True when we're on the clean map view with nothing open
  const showMapOnlyButtons = !selectedMilestoneId && !isLogOpen && !isAnalyticsOpen && !isChatOpen && !isSettingsOpen

  // Any bottom-right panel button should hide when ANY other panel in that stack is open
  const anyBottomPanelOpen = isLogOpen || isChatOpen

  return (
    <ThemeProvider>
      <div
        className={`min-h-screen font-sans ${
          theme === 'dark' ? 'bg-animated-dark' : 'bg-animated-light'
        }`}
        style={{ color: palette.text }}
      >
        {/* Bubble Map (always rendered) */}
        <BubbleMap />

        {/* Cell Colony Strip — left edge timeline */}
        {showMapOnlyButtons && <CellColonyStrip />}

        <GooTuningPanel />

        {/* Typewriter terminal — map view only */}
        {showMapOnlyButtons && (
          <TypewriterTerminal />
        )}

        {/* Milestone Detail View (overlay) */}
        <AnimatePresence>
          {selectedMilestoneId && (
            <motion.div
              key="milestone-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={null}>
                <MilestoneDetail milestoneId={selectedMilestoneId} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom-right button stack: recenter, daily log, chat */}
        {/* ALL buttons in this stack hide when any bottom panel (log or chat) is open */}
        <AnimatePresence>
          {!anyBottomPanelOpen && !selectedMilestoneId && !isAnalyticsOpen && !isSettingsOpen && (
            <motion.div
              key="bottom-right-buttons"
              className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Recenter / Fit-all button */}
              <FloatingButton
                onClick={() => window.dispatchEvent(new CustomEvent('cyto-recenter'))}
                position="inline"
                phaseColor={phaseColor(0)}
                className="w-11 h-11 !px-0 flex items-center justify-center"
              >
                {recenterMode === 'focus' ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                ) : (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </FloatingButton>

              {/* TODO: Re-enable daily log FAB button */}
              {/* <FloatingButton
                onClick={toggleLog}
                position="inline"
                phaseColor={phaseColor(3)}
                className="w-12 h-12 !px-0 flex items-center justify-center"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </FloatingButton> */}

              {/* Chat button */}
              <FloatingButton
                onClick={() => openChat()}
                position="inline"
                phaseColor={phaseColor(2)}
                className="w-12 h-12 !px-0 flex items-center justify-center"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </FloatingButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics — bottom-left, mirrors bottom-right stack padding */}
        <AnimatePresence>
          {showMapOnlyButtons && (
            <motion.div
              key="bottom-left-buttons"
              className="fixed z-40 flex flex-col items-center gap-3"
              style={{ bottom: '1.5rem', left: '1.5rem' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <FloatingButton
                onClick={toggleAnalytics}
                position="inline"
                phaseColor={phaseColor(5)}
                className="w-12 h-12 !px-0 flex items-center justify-center"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
              </FloatingButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings — top-right */}
        <AnimatePresence>
          {showMapOnlyButtons && (
            <motion.div
              key="top-right-buttons"
              className="fixed z-40"
              style={{ top: '1.5rem', right: '1.5rem' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <FloatingButton
                onClick={() => useUIStore.getState().toggleSettings()}
                position="inline"
                phaseColor={phaseColor(2)}
                className="w-11 h-11 !px-0 !p-0 flex items-center justify-center"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </FloatingButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Log Panel */}
        <AnimatePresence>
          {isLogOpen && (
            <Suspense fallback={null}>
              <DailyLogPanel onClose={closeLog} />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Analytics Dashboard */}
        <AnimatePresence>
          {isAnalyticsOpen && (
            <Suspense fallback={null}>
              <AnalyticsDashboard onClose={closeAnalytics} />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Chat Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <Suspense fallback={null}>
              <ChatPanel
                onClose={closeChat}
                milestoneContext={selectedMilestoneId ?? undefined}
              />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && (
            <Suspense fallback={null}>
              <SettingsPanel onClose={closeSettings} />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  )
}
