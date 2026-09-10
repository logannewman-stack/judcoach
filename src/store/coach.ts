import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CoachAuthor, CoachNote, NoteAnchor } from '../domain/coach'
import { anchorKey, byTime, sameAnchor, unreadFrom } from '../domain/coach'
import { createResilientStorage } from './persist'
import { seedCoachThread } from '../data/coachSeed'
import { seedCheckIns, seedStartDate, seedWeighIns, seedWorkoutLogs } from '../data/seed'
import { todayISO } from '../lib/date'
import { uid } from '../lib/id'

/* ============================================================================
   The conversation with Jud.

   Kept in its own key rather than folded into the training store, because it is
   a different kind of data with a different owner. Everything in the main store
   is the client's own record of what they did, exported and imported as one
   document. A conversation has two authors, would be server-backed the moment
   Jud has a console of his own, and should not travel inside a client's backup
   of their training history.
   ========================================================================== */

export interface CoachState {
  notes: CoachNote[]
  /**
   * Whose side of the conversation the app is showing. There is no server and
   * no second device, so the demo switches seats instead: in `coach` the
   * outgoing messages are Jud's and every reply box writes as him.
   */
  viewAs: CoachAuthor
  setViewAs: (who: CoachAuthor) => void
  /** Sends as whoever is currently holding the phone. */
  send: (anchor: NoteAnchor, body: string) => void
  remove: (id: string) => void
  /** Marks what the other side has said as read. */
  markRead: (anchor?: NoteAnchor) => void
  resetToSeed: () => void
  clear: () => void
}

function seed(): CoachNote[] {
  const today = todayISO()
  const start = seedStartDate(today)
  return seedCoachThread(
    seedWorkoutLogs(today, start),
    seedWeighIns(today),
    seedCheckIns(today),
    today,
  )
}

export const useCoach = create<CoachState>()(
  persist(
    (set) => ({
      notes: seed(),
      viewAs: 'client',

      setViewAs: (who) => set({ viewAs: who }),

      send: (anchor, body) =>
        set((s) => {
          const text = body.trim()
          if (!text) return s
          return {
            notes: [
              ...s.notes,
              {
                id: uid('note'),
                anchor,
                author: s.viewAs,
                body: text,
                sentAt: new Date().toISOString(),
              },
            ],
          }
        }),

      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      /** Without an anchor, marks the whole conversation read. */
      markRead: (anchor) =>
        set((s) => {
          const now = new Date().toISOString()
          let changed = false
          const notes = s.notes.map((n) => {
            // You cannot read your own message, only the other side's.
            if (n.author === s.viewAs || n.readAt) return n
            if (anchor && !sameAnchor(n.anchor, anchor)) return n
            changed = true
            return { ...n, readAt: now }
          })
          // Returning a new array unconditionally would re-render every reader
          // on each screen visit, marked or not.
          return changed ? { notes } : s
        }),

      resetToSeed: () => set({ notes: seed(), viewAs: 'client' }),
      clear: () => set({ notes: [], viewAs: 'client' }),
    }),
    {
      name: 'grit-coach-v1',
      storage: createJSONStorage(createResilientStorage),
      partialize: (s) => ({ notes: s.notes, viewAs: s.viewAs }),
    },
  ),
)

/* -------------------------------- selectors ------------------------------- */

/** Everything attached to one record, oldest first. */
export function notesFor(notes: CoachNote[], anchor: NoteAnchor): CoachNote[] {
  return byTime(notes.filter((n) => sameAnchor(n.anchor, anchor)))
}

/** Unread messages from the other side, by what they are attached to. */
export function unreadByAnchor(notes: CoachNote[], viewer: CoachAuthor): Record<string, number> {
  const out: Record<string, number> = {}
  for (const note of unreadFrom(notes, viewer)) {
    const key = anchorKey(note.anchor)
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}
