import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { ActionCard } from './ActionCard'
import { useChatStore } from '@/stores/chatStore'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { sendMessage } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/utils/cytoPrompt'
import { parseActions } from '@/utils/actionParser'
import type { ChatMessage, RoadmapAction } from '@/types'

interface ChatPanelProps {
  onClose: () => void
  milestoneContext?: string
}

export function ChatPanel({ onClose, milestoneContext }: ChatPanelProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const messages = useChatStore((s) => s.messages)
  const addMessage = useChatStore((s) => s.addMessage)
  const isLoading = useChatStore((s) => s.isLoading)
  const setLoading = useChatStore((s) => s.setLoading)
  const toggleActionItem = useRoadmapStore((s) => s.toggleActionItem)
  const addMilestoneNote = useRoadmapStore((s) => s.addMilestoneNote)

  const [input, setInput] = useState('')
  const [pendingActions, setPendingActions] = useState<RoadmapAction[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      milestoneContext,
    }
    await addMessage(userMessage)

    setLoading(true)
    try {
      const systemPrompt = buildSystemPrompt(milestoneContext)

      // Build conversation history for API (last 20 messages for context window)
      const recentMessages = [...messages, userMessage]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }))

      const responseText = await sendMessage(recentMessages, systemPrompt)

      // Parse any actions from the response
      const { cleanText, actions } = parseActions(responseText)

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: cleanText || responseText,
        timestamp: Date.now(),
        milestoneContext,
        actions: actions.length > 0 ? actions : undefined,
      }
      await addMessage(assistantMessage)

      if (actions.length > 0) {
        setPendingActions(actions)
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Something went wrong. Check your API key in Settings.',
        timestamp: Date.now(),
        milestoneContext,
      }
      await addMessage(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, messages, milestoneContext, addMessage, setLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApplyAction = async (action: RoadmapAction) => {
    switch (action.action) {
      case 'complete_item':
        await toggleActionItem(action.target)
        break
      case 'add_note':
        if (milestoneContext && typeof action.data?.content === 'string') {
          await addMilestoneNote(milestoneContext, action.data.content)
        }
        break
      // Other actions can be handled as needed
    }
    setPendingActions((prev) => prev.filter((a) => a !== action))
  }

  const handleDismissAction = (action: RoadmapAction) => {
    setPendingActions((prev) => prev.filter((a) => a !== action))
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

      {/* Chat panel */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
        className={`fixed z-40 flex flex-col
          inset-x-4 bottom-4 top-16
          md:inset-auto md:bottom-8 md:right-8 md:w-[420px] md:h-[600px]
          ${isDark ? 'bg-navy/95' : 'bg-cream/95'}
          backdrop-blur-xl rounded-[28px] shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'border-white/5' : 'border-black/5'
        }`}>
          <div>
            <h2 className="font-display text-lg font-bold">cyto</h2>
            <p className="text-[10px] opacity-40">
              {milestoneContext ? 'Milestone context active' : 'Your health coach'}
            </p>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm opacity-30">Say something to cyto...</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <TypingIndicator />
            </div>
          )}
          {/* Pending action cards */}
          {pendingActions.map((action, i) => (
            <ActionCard
              key={i}
              action={action}
              onApply={() => handleApplyAction(action)}
              onDismiss={() => handleDismissAction(action)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`px-4 py-3 border-t ${isDark ? 'border-white/5' : 'border-black/5'}`}>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message cyto..."
              rows={1}
              className={`flex-1 px-4 py-2 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/5 focus:ring-copper/30 placeholder:text-white/20'
                  : 'bg-black/[0.03] focus:ring-gold/30 placeholder:text-black/20'
              }`}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`self-end px-4 py-2 rounded-full text-sm font-medium transition-opacity ${
                isDark ? 'bg-copper/20 hover:bg-copper/30' : 'bg-gold/20 hover:bg-gold/30'
              } ${!input.trim() || isLoading ? 'opacity-30' : ''}`}
            >
              Send
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
