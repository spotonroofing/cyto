import { useTheme } from '@/themes'
import type { ChatMessage } from '@/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { palette } = useTheme()
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? 'rounded-[18px] rounded-br-md'
            : 'rounded-[18px] rounded-bl-md'
        }`}
        style={{
          backgroundColor: isUser ? palette.accent + '33' : palette.border,
          color: palette.text,
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
