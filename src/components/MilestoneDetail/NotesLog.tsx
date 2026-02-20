import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'

interface NotesLogProps {
  milestoneId: string
}

export function NotesLog({ milestoneId }: NotesLogProps) {
  const { palette, isDark } = useTheme()
  const getNotesForMilestone = useRoadmapStore((s) => s.getNotesForMilestone)
  const addMilestoneNote = useRoadmapStore((s) => s.addMilestoneNote)
  const deleteMilestoneNote = useRoadmapStore((s) => s.deleteMilestoneNote)

  const [newNote, setNewNote] = useState('')
  const notes = getNotesForMilestone(milestoneId)

  const handleAddNote = () => {
    const trimmed = newNote.trim()
    if (!trimmed) return
    addMilestoneNote(milestoneId, trimmed)
    setNewNote('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddNote()
    }
  }

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Notes</h3>

      {/* Note input */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          rows={2}
          className={`flex-1 px-4 py-2 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 ${
            isDark
              ? 'bg-white/5 placeholder:text-white/30'
              : 'bg-black/[0.03] placeholder:text-black/30'
          }`}
          style={{ '--tw-ring-color': palette.accent + '4D' } as React.CSSProperties}
        />
        <button
          onClick={handleAddNote}
          disabled={!newNote.trim()}
          className={`self-end px-4 py-2 rounded-full text-sm font-medium transition-opacity ${
            !newNote.trim() ? 'opacity-30' : ''
          }`}
          style={{ backgroundColor: palette.accent + '33' }}
        >
          Add
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-2">
        <AnimatePresence>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className={`p-3 rounded-2xl group ${
                isDark ? 'bg-white/5' : 'bg-black/[0.03]'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono opacity-40">
                  {new Date(note.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  onClick={() => deleteMilestoneNote(note.id)}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-70 text-[10px] transition-opacity"
                >
                  delete
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {notes.length === 0 && (
          <p className="text-sm opacity-30 text-center py-4">No notes yet</p>
        )}
      </div>
    </div>
  )
}
