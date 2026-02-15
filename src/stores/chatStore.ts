import { create } from 'zustand'
import { db } from '@/lib/db'
import type { ChatMessage } from '@/types'

interface ChatState {
  messages: ChatMessage[]
  initialized: boolean
  isLoading: boolean

  initialize: () => Promise<void>
  addMessage: (message: ChatMessage) => Promise<void>
  setLoading: (loading: boolean) => void
  getMessagesForMilestone: (milestoneId: string) => ChatMessage[]
  clearHistory: () => Promise<void>
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  initialized: false,
  isLoading: false,

  initialize: async () => {
    const messages = await db.chatMessages.orderBy('timestamp').toArray()
    set({ messages, initialized: true })
  },

  addMessage: async (message: ChatMessage) => {
    await db.chatMessages.put(message)
    set((state) => ({ messages: [...state.messages, message] }))
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  getMessagesForMilestone: (milestoneId: string) => {
    return get().messages.filter((m) => m.milestoneContext === milestoneId)
  },

  clearHistory: async () => {
    await db.chatMessages.clear()
    set({ messages: [] })
  },
}))
