import { useSettingsStore } from '@/stores/settingsStore'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>
}

export async function sendMessage(
  messages: AnthropicMessage[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = useSettingsStore.getState().anthropicApiKey

  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Please add your API key in Settings.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`)
  }

  const data: AnthropicResponse = await response.json()
  const textContent = data.content.find((c) => c.type === 'text')
  return textContent?.text ?? ''
}
