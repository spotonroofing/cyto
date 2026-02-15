import { useSettingsStore } from '@/stores/settingsStore'
import type { ChatMessage } from '@/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? `rounded-[18px] rounded-br-md ${isDark ? 'bg-copper/20 text-softwhite' : 'bg-gold/20 text-charcoal'}`
            : `rounded-[18px] rounded-bl-md ${isDark ? 'bg-white/5 text-softwhite' : 'bg-black/[0.04] text-charcoal'}`
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
