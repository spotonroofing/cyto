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

// Lazy-loaded overlays (not needed on initial render)
const MilestoneDetail = lazy(() => import('@/components/MilestoneDetail/MilestoneDetail').then((m) => ({ default: m.MilestoneDetail })))
const DailyLogPanel = lazy(() => import('@/components/DailyLog/DailyLogPanel').then((m) => ({ default: m.DailyLogPanel })))
const AnalyticsDashboard = lazy(() => import('@/components/Analytics/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })))
const ChatPanel = lazy(() => import('@/components/Chat/ChatPanel').then((m) => ({ default: m.ChatPanel })))
const SettingsPanel = lazy(() => import('@/components/Settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })))

export function App() {
  const theme = useSettingsStore((s) => s.theme)
  const selectedMilestoneId = useUIStore((s) => s.selectedMilestoneId)
  const isLogOpen = useUIStore((s) => s.isLogOpen)
  const isAnalyticsOpen = useUIStore((s) => s.isAnalyticsOpen)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const toggleLog = useUIStore((s) => s.toggleLog)
  const closeLog = useUIStore((s) => s.closeLog)
  const toggleAnalytics = useUIStore((s) => s.toggleAnalytics)
  const closeAnalytics = useUIStore((s) => s.closeAnalytics)
  const openChat = useUIStore((s) => s.openChat)
  const closeChat = useUIStore((s) => s.closeChat)
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen)
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      useRoadmapStore.getState().initialize(),
      useDailyLogStore.getState().initialize(),
      useChatStore.getState().initialize(),
    ]).then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-animated-dark' : 'bg-animated-light'
      }`}>
        <div className="font-display text-2xl opacity-60 text-charcoal dark:text-softwhite">
          Loading...
        </div>
      </div>
    )
  }

  const showFloatingButtons = !selectedMilestoneId && !isLogOpen && !isAnalyticsOpen && !isChatOpen

  return (
    <ThemeProvider>
      <div
        className={`min-h-screen text-charcoal dark:text-softwhite font-sans ${
          theme === 'dark' ? 'bg-animated-dark' : 'bg-animated-light'
        }`}
      >
        {/* Bubble Map (always rendered) */}
        <BubbleMap />

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

        {/* Bottom-right button stack — always visible */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
          {/* Location/recenter button */}
          {showFloatingButtons && (
            <FloatingButton
              onClick={() => {
                window.dispatchEvent(new CustomEvent('cyto-recenter'))
              }}
              position="inline"
              className="w-11 h-11 !px-0 flex items-center justify-center"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </FloatingButton>
          )}

          {/* Daily log + button */}
          {showFloatingButtons && (
            <FloatingButton
              onClick={toggleLog}
              position="inline"
              className="w-11 h-11 !px-0 flex items-center justify-center text-lg"
            >
              +
            </FloatingButton>
          )}

          {/* Chat button — always visible unless chat open */}
          {!isChatOpen && (
            <FloatingButton
              onClick={() => openChat()}
              position="inline"
              className="w-11 h-11 !px-0 flex items-center justify-center"
            >
              <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
                <path d="M3 9C3 5.686 5.686 3 9 3C12.314 3 15 5.686 15 9C15 12.314 12.314 15 9 15C7.92 15 6.903 14.73 6.003 14.253L3 15L3.747 11.997C3.27 11.097 3 10.08 3 9Z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </FloatingButton>
          )}
        </div>

        {/* Analytics button stays bottom-left */}
        {showFloatingButtons && (
          <FloatingButton
            onClick={toggleAnalytics}
            position="bottom-left"
            className="w-11 h-11 !px-0 flex items-center justify-center"
          >
            <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
              <path d="M2 14V8M6 14V4M10 14V10M14 14V6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </FloatingButton>
        )}

        {/* Settings stays top-right */}
        {showFloatingButtons && (
          <FloatingButton
            onClick={() => useUIStore.getState().toggleSettings()}
            position="top-right"
            className="w-10 h-10 !px-0 flex items-center justify-center"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </FloatingButton>
        )}

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
