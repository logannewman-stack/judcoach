import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Units } from '../domain/types'
import type { CoachAuthor, CoachNote, NoteAnchor } from '../domain/coach'
import { anchorKey, byTime, sameAnchor, unreadFrom } from '../domain/coach'
import { createResilientStorage, onForeignWrite } from './persist'
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

const COACH_KEY = 'grit-coach-v1'

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
  /** Restates the figures Jud has highlighted in the client's current unit. */
  restateFigures: (units: Units) => void
  resetToSeed: () => void
  clear: () => void
}

/**
 * The demo conversation, written against the same history the app is showing.
 *
 * `units` is the client's, not the seed's: `seedCoachThread` converts the
 * sample history internally and writes Jud's figures off the converted numbers,
 * so a thread seeded in pounds beside a history the app has since put into
 * kilos quotes an estimated max of 471 over a session detail reading 213.
 */
function seed(units?: Units): CoachNote[] {
  const today = todayISO()
  const start = seedStartDate(today)
  return seedCoachThread(
    seedWorkoutLogs(today, start),
    seedWeighIns(today),
    seedCheckIns(today),
    today,
    units,
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

      /**
       * Without an anchor, marks the whole conversation read — which is right,
       * because the Messages screen shows every note, anchored or not.
       *
       * It is symmetric, and `readAt` is one field shared by both seats, so
       * opening Messages as Jud stamps the client's own messages and their
       * receipt turns from "Delivered" to "Read" with nobody having read it.
       * Stamping only coach-authored notes would fix that and freeze Jud's own
       * unread badge at whatever the client last sent, because `unreadFrom`
       * reads the same field from the other side. One field cannot carry two
       * receipts: the honest fix is a second stamp in domain/coach.ts.
       */
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

      /**
       * Put the seeded conversation back into the unit the app now reads in.
       *
       * The demo's messages quote the sample client's own numbers — "400 lb for
       * 3", and an estimated max drawn in the data face beside the session it is
       * about — so when the store converts every weight the client owns, these
       * have to travel with them or Jud is talking pounds over a history in
       * kilos. Rewritten from the seed rather than parsed back out of the
       * sentences, because the seed is where they were written in the first
       * place and it takes the unit as an argument.
       *
       * Only what the seed still recognises moves. A note the client has sent
       * is not in it and is never touched; neither is a seeded one whose anchor
       * no longer matches, which is what a script that has shifted since the
       * thread was written looks like. Nothing is resurrected, nothing is
       * resorted, and a message already read stays read.
       */
      restateFigures: (units) =>
        set((s) => {
          const fresh = new Map(seed(units).map((n) => [n.id, n]))
          let changed = false
          const notes = s.notes.map((note) => {
            const written = fresh.get(note.id)
            if (!written || !sameAnchor(written.anchor, note.anchor)) return note
            if (written.body === note.body && written.highlight?.value === note.highlight?.value) {
              return note
            }
            changed = true
            return { ...note, body: written.body, highlight: written.highlight }
          })
          return changed ? { notes } : s
        }),

      resetToSeed: () => set({ notes: seed(), viewAs: 'client' }),
      clear: () => set({ notes: [], viewAs: 'client' }),
    }),
    {
      name: COACH_KEY,
      storage: createJSONStorage(createResilientStorage),
      partialize: (s) => ({ notes: s.notes, viewAs: s.viewAs }),
    },
  ),
)

/* The conversation is one conversation however many tabs are open on it. */
onForeignWrite(COACH_KEY, () => {
  void useCoach.persist.rehydrate()
})

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
