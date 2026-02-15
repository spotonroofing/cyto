import { useEffect, useState, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
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
            <Suspense fallback={null}>
              <MilestoneDetail milestoneId={selectedMilestoneId} />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Floating buttons on map view */}
        {showFloatingButtons && (
          <>
            {/* Settings gear (Spec 9.1: top-right) */}
            <FloatingButton
              onClick={() => useUIStore.getState().toggleSettings()}
              position="top-right"
              className="bg-gold/15 dark:bg-copper/15 text-charcoal dark:text-softwhite hover:bg-gold/25 dark:hover:bg-copper/25 w-10 h-10 !px-0 flex items-center justify-center"
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10Z" stroke="currentColor" strokeWidth={1.5} />
                <path d="M13 8C13 7.64 12.97 7.29 12.92 6.95L14.5 5.82L13.5 4.09L11.67 4.72C11.16 4.28 10.57 3.94 9.92 3.72L9.5 1.82H7.5L7.08 3.72C6.43 3.94 5.84 4.28 5.33 4.72L3.5 4.09L2.5 5.82L4.08 6.95C4.03 7.29 4 7.64 4 8C4 8.36 4.03 8.71 4.08 9.05L2.5 10.18L3.5 11.91L5.33 11.28C5.84 11.72 6.43 12.06 7.08 12.28L7.5 14.18H9.5L9.92 12.28C10.57 12.06 11.16 11.72 11.67 11.28L13.5 11.91L14.5 10.18L12.92 9.05C12.97 8.71 13 8.36 13 8Z" stroke="currentColor" strokeWidth={1.5} />
              </svg>
            </FloatingButton>

            {/* Analytics chart button (Spec 7.1: bottom-left) */}
            <FloatingButton
              onClick={toggleAnalytics}
              position="bottom-left"
              className="bg-gold/25 dark:bg-copper/25 text-charcoal dark:text-softwhite hover:bg-gold/35 dark:hover:bg-copper/35 w-12 h-12 !px-0 flex items-center justify-center"
            >
              <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                <path d="M2 14V8M6 14V4M10 14V10M14 14V6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </FloatingButton>

            {/* cyto Chat button */}
            <FloatingButton
              onClick={() => openChat()}
              position="bottom-right"
              className="bg-gold/25 dark:bg-copper/25 text-charcoal dark:text-softwhite hover:bg-gold/35 dark:hover:bg-copper/35 w-12 h-12 !px-0 flex items-center justify-center mb-16"
            >
              <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                <path d="M3 9C3 5.686 5.686 3 9 3C12.314 3 15 5.686 15 9C15 12.314 12.314 15 9 15C7.92 15 6.903 14.73 6.003 14.253L3 15L3.747 11.997C3.27 11.097 3 10.08 3 9Z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </FloatingButton>

            {/* Daily Log "+" button (Spec 6.2: bottom-right) */}
            <FloatingButton
              onClick={toggleLog}
              position="bottom-right"
              className="bg-gold/25 dark:bg-copper/25 text-charcoal dark:text-softwhite hover:bg-gold/35 dark:hover:bg-copper/35 w-12 h-12 !px-0 flex items-center justify-center text-xl"
            >
              +
            </FloatingButton>
          </>
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
