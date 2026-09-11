/* ============================================================================
   Coach messages.

   Two things at once, deliberately. A client can message Jud like any other
   thread, and Jud can attach a message to one specific thing they did — a
   session, a morning's weight, a check-in, a progress photo. An anchored note
   shows up in two places: in the thread, and on the record itself, so feedback
   sits next to the numbers it is about rather than scrolling away.
   ========================================================================== */

export type CoachAuthor = 'coach' | 'client'

/** What a message is attached to. `thread` is a plain message with no anchor. */
export type NoteAnchor =
  | { kind: 'thread' }
  | { kind: 'workout'; id: string }
  | { kind: 'weighIn'; id: string }
  | { kind: 'checkIn'; id: string }
  | { kind: 'photo'; id: string }
  | { kind: 'exercise'; id: string }

export type AnchorKind = NoteAnchor['kind']

export interface CoachNote {
  id: string
  anchor: NoteAnchor
  author: CoachAuthor
  body: string
  /** ISO timestamp. */
  sentAt: string
  /** Set when the client has seen it. Coach messages only. */
  readAt?: string
  /** A number Jud wants the client looking at while they read this. */
  highlight?: { label: string; value: string }
}

export const THREAD: NoteAnchor = { kind: 'thread' }

export function sameAnchor(a: NoteAnchor, b: NoteAnchor): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'thread' || (a as { id: string }).id === (b as { id: string }).id
}

export function anchorKey(anchor: NoteAnchor): string {
  return anchor.kind === 'thread' ? 'thread' : `${anchor.kind}:${anchor.id}`
}

/**
 * Oldest first — a conversation reads down the page.
 *
 * By instant, not by string. A sent message carries the Z that `toISOString`
 * writes and a seeded one is local-naive, so comparing the text put a message
 * sent at 00:57Z before one seeded at 07:05 the same morning, and the reply
 * landed above the thing it was replying to.
 */
export function byTime(notes: CoachNote[]): CoachNote[] {
  return [...notes].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))
}

/** What the other side has said and this one has not seen. */
export function unreadFrom(notes: CoachNote[], viewer: CoachAuthor = 'client'): CoachNote[] {
  return notes.filter((n) => n.author !== viewer && !n.readAt)
}

/**
 * Consecutive messages from one person, about the same thing, sent close
 * together, render as one group: tight spacing, a single tail, one timestamp.
 */
const GROUP_WINDOW_MS = 4 * 60 * 1000

export interface NoteGroup {
  author: CoachAuthor
  notes: CoachNote[]
}

export function groupNotes(notes: CoachNote[]): NoteGroup[] {
  const groups: NoteGroup[] = []
  for (const note of byTime(notes)) {
    const last = groups.at(-1)
    const previous = last?.notes.at(-1)
    const joins =
      last?.author === note.author
      && previous != null
      && sameAnchor(previous.anchor, note.anchor)
      && Date.parse(note.sentAt) - Date.parse(previous.sentAt) < GROUP_WINDOW_MS
    if (joins) last!.notes.push(note)
    else groups.push({ author: note.author, notes: [note] })
  }
  return groups
}

/** How an anchored note labels itself when it appears outside its own record. */
export const ANCHOR_LABEL: Record<AnchorKind, string> = {
  thread: 'Message',
  workout: 'Workout',
  weighIn: 'Weigh-in',
  checkIn: 'Check-in',
  photo: 'Progress photo',
  exercise: 'Movement',
}
