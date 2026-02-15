import type { RoadmapAction, RoadmapActionType } from '@/types'

const validActions: RoadmapActionType[] = ['add_item', 'remove_item', 'complete_item', 'update_date', 'add_note']

/**
 * Parses JSON action blocks from cyto's response text.
 * Returns the cleaned message text (with action blocks removed) and any parsed actions.
 */
export function parseActions(text: string): {
  cleanText: string
  actions: RoadmapAction[]
} {
  const actions: RoadmapAction[] = []
  let cleanText = text

  // Match JSON blocks in code fences
  const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?```/g
  let match: RegExpExecArray | null

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!)
      if (isValidAction(parsed)) {
        actions.push(parsed)
        cleanText = cleanText.replace(match[0], '')
      }
    } catch {
      // Not valid JSON, leave it in the text
    }
  }

  // Also try to find inline JSON objects (not in code fences)
  const inlineJsonRegex = /\{[\s]*"action"[\s]*:[\s]*"[^"]*"[\s\S]*?\}/g
  let inlineMatch: RegExpExecArray | null

  while ((inlineMatch = inlineJsonRegex.exec(text)) !== null) {
    // Skip if this was already captured in a code fence
    if (actions.length > 0) continue
    try {
      const parsed = JSON.parse(inlineMatch[0])
      if (isValidAction(parsed)) {
        actions.push(parsed)
        cleanText = cleanText.replace(inlineMatch[0], '')
      }
    } catch {
      // Not valid JSON
    }
  }

  return {
    cleanText: cleanText.trim(),
    actions,
  }
}

function isValidAction(obj: unknown): obj is RoadmapAction {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    typeof o.action === 'string' &&
    validActions.includes(o.action as RoadmapActionType) &&
    typeof o.target === 'string'
  )
}
