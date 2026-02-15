import { useRoadmapStore } from '@/stores/roadmapStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { milestones, phases } from '@/data/roadmap'
import { defaultHealthContext } from '@/data/healthContext'
import { phaseNames } from '@/styles/theme'

export function buildSystemPrompt(milestoneContext?: string): string {
  const roadmapState = useRoadmapStore.getState()
  const logState = useDailyLogStore.getState()
  const settingsState = useSettingsStore.getState()

  // Health context (may be customized in settings, or default)
  const healthContext = settingsState.healthContext ?? defaultHealthContext

  // Current roadmap state
  const currentMilestone = roadmapState.getCurrentMilestone()
  const roadmapSummary = buildRoadmapSummary(roadmapState)

  // Recent logs (last 7 days)
  const recentLogs = logState.getRecentLogs(7)
  const logSummary = recentLogs.length > 0
    ? recentLogs.map((l) =>
      `${l.date}: Energy=${l.energy} Fog=${l.fog} Mood=${l.mood} Sleep=${l.sleep}${l.flare ? ` FLARE(${l.flareSeverity}/5${l.flareTrigger ? `: ${l.flareTrigger}` : ''})` : ''}${l.weight ? ` Weight=${l.weight}lbs` : ''}${l.foods.length > 0 ? ` Foods=[${l.foods.join(', ')}]` : ''}`
    ).join('\n')
    : 'No recent logs.'

  // Milestone-specific context
  const milestoneInfo = milestoneContext
    ? buildMilestoneInfo(milestoneContext, roadmapState)
    : ''

  return `You are cyto, Willem's health recovery coach. You're direct, you don't sugarcoat things, and you push him when he's slacking. You're like a best friend who genuinely cares but isn't afraid to call him out. When he's doing well, you hype him up. When he's falling behind, you get on his case — not mean, but firm and honest. You know his full medical history and protocol. You never give generic wellness advice. Everything you say is grounded in HIS specific data and situation. You ARE the app — you're the living organism that wraps around his health journey, and you take that responsibility seriously.

Always refer to yourself as cyto. Keep responses concise and actionable.

When Willem asks to make changes to his roadmap (add items, remove items, adjust dates, mark things complete), output a structured JSON action block that the app will parse and execute. Format:
\`\`\`json
{ "action": "add_item" | "remove_item" | "complete_item" | "update_date" | "add_note", "target": "<item_id>", "data": {} }
\`\`\`

=== HEALTH CONTEXT ===
${healthContext}

=== CURRENT ROADMAP STATE ===
Current phase: ${currentMilestone ? phaseNames[phases.findIndex((p) => p.id === currentMilestone.phaseId)] : 'Unknown'}
Current milestone: ${currentMilestone?.title ?? 'None'}
${roadmapSummary}

=== RECENT DAILY LOGS (Last 7 days) ===
${logSummary}

${milestoneInfo ? `=== CURRENT MILESTONE CONTEXT ===\n${milestoneInfo}` : ''}`
}

function buildRoadmapSummary(state: ReturnType<typeof useRoadmapStore.getState>): string {
  return milestones.map((ms) => {
    const phase = phases.find((p) => p.id === ms.phaseId)
    const phaseIndex = phase ? phases.indexOf(phase) : 0
    const progress = state.getMilestoneProgress(ms.id)
    const status = state.getMilestoneStatus(ms.id)
    return `Phase ${phaseIndex} (${phaseNames[phaseIndex]}): ${ms.title} — ${progress.completed}/${progress.total} items (${status})`
  }).join('\n')
}

function buildMilestoneInfo(milestoneId: string, state: ReturnType<typeof useRoadmapStore.getState>): string {
  const ms = milestones.find((m) => m.id === milestoneId)
  if (!ms) return ''

  const items = state.getActionItemsForMilestone(milestoneId)
  const itemList = items.map((item) =>
    `- [${item.completed ? 'x' : ' '}] ${item.title} (${item.id})${item.foodTrial?.outcome ? ` [${item.foodTrial.outcome}]` : ''}`
  ).join('\n')

  const notes = state.getNotesForMilestone(milestoneId)
  const notesList = notes.length > 0
    ? notes.map((n) => `- ${new Date(n.timestamp).toLocaleDateString()}: ${n.content}`).join('\n')
    : 'No notes.'

  return `Milestone: ${ms.title}
Description: ${ms.description}

Action Items:
${itemList}

Notes:
${notesList}`
}
