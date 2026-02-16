import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const messages = [
  'initializing recovery protocol...',
  'mapping gut microbiome state...',
  'analyzing phase dependencies...',
  'cyto is watching over you.',
  'all systems nominal.',
  'trust the process.',
  'one milestone at a time.',
]

export function TypewriterTerminal() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [displayText, setDisplayText] = useState('')
  const [messageIndex, setMessageIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)
    return () => clearInterval(interval)
  }, [])

  // Typing effect
  useEffect(() => {
    const msg = messages[messageIndex % messages.length]!

    if (displayText.length < msg.length) {
      const speed = 30 + Math.random() * 50
      timeoutRef.current = setTimeout(() => {
        setDisplayText(msg.slice(0, displayText.length + 1))
      }, speed)
    } else {
      // Pause at end, then move to next
      timeoutRef.current = setTimeout(() => {
        setDisplayText('')
        setMessageIndex((i) => (i + 1) % messages.length)
      }, 3000)
    }

    return () => clearTimeout(timeoutRef.current)
  }, [displayText, messageIndex])

  return (
    <div
      className="fixed top-5 left-5 z-30 pointer-events-none select-none"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        opacity: 0.55,
      }}
    >
      <span style={{ color: isDark ? '#9B72CF' : '#D8BBFF' }}>{'>'} </span>
      <span style={{ color: isDark ? '#FFFFFE' : '#2D2A32' }}>
        {displayText}
      </span>
      <span
        style={{
          color: isDark ? '#9B72CF' : '#D8BBFF',
          opacity: showCursor ? 1 : 0,
        }}
      >
        _
      </span>
    </div>
  )
}
