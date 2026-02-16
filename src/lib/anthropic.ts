interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>
}

export async function sendMessage(
  _messages: AnthropicMessage[],
  _systemPrompt: string,
): Promise<string> {
  // Chat is handled via OpenClaw agent — direct API calls are not supported in the web app
  throw new Error('Chat is handled via the OpenClaw agent. Direct API calls are not supported in the web app.')
}

export type { AnthropicMessage, AnthropicResponse }
