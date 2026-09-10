import { useEffect, useMemo, useState } from 'react'
import { CoachAvatar } from './Bits'
import { Icon } from './Icon'
import { useCoach, notesFor } from '../store/coach'
import type { NoteAnchor } from '../domain/coach'
import { COACH } from '../data/seed'
import { formatMediumDate } from '../lib/date'
import { haptic } from '../lib/haptics'

/* ============================================================================
   Jud's notes on one record, shown on the record itself.

   The same messages as the thread, put where they are actually useful: a note
   about a set sits under that set, not twelve screens back in a conversation.
   The client can answer from here, and the reply lands in the thread.
   ========================================================================== */

const relative = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return formatMediumDate(iso.slice(0, 10))
}

export function CoachNotes({
  anchor,
  /** Shown when Jud has said nothing about this record yet. */
  empty,
}: {
  anchor: NoteAnchor
  empty?: string
}) {
  const all = useCoach((s) => s.notes)
  const send = useCoach((s) => s.send)
  const markRead = useCoach((s) => s.markRead)
  const notes = useMemo(() => notesFor(all, anchor), [all, anchor])
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')

  const unread = notes.some((n) => n.author === 'coach' && !n.readAt)
  // Seeing the note is reading it, but only once the record is actually open.
  useEffect(() => {
    if (unread) markRead(anchor)
    // The anchor is a fresh object each render; its identity is the key.
  }, [unread, markRead, anchor.kind, (anchor as { id?: string }).id])

  const submit = () => {
    const body = draft.trim()
    if (!body) return
    send(anchor, body)
    setDraft('')
    setReplying(false)
    haptic('light')
  }

  if (notes.length === 0 && !empty) return null

  return (
    <div className="note-strip">
      {notes.length === 0 ? (
        <div className="t-footnote dim" style={{ padding: '2px 2px 0' }}>{empty}</div>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="note" data-from={note.author}>
            {note.author === 'coach' && <CoachAvatar size={30} name={COACH.name} />}
            <div className="note-body">
              <div className="note-name">
                {note.author === 'coach' ? COACH.name : 'You'} · {relative(note.sentAt)}
                {note.author === 'coach' && !note.readAt && <span className="note-unread" />}
              </div>
              {note.body}
              {note.highlight && (
                <div className="msg-highlight">
                  <span>{note.highlight.label}</span>
                  <span className="msg-highlight-value">{note.highlight.value}</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {replying ? (
        <div className="compose" style={{ padding: '4px 0 0' }}>
          <textarea
            className="compose-field"
            autoFocus
            rows={1}
            value={draft}
            placeholder={`Reply to ${COACH.name}`}
            aria-label={`Reply to ${COACH.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') setReplying(false)
            }}
          />
          <button
            type="button"
            className="compose-send"
            disabled={draft.trim().length === 0}
            aria-label="Send reply"
            onClick={submit}
          >
            <Icon name="send.fill" size={19} weight={2.6} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-gray"
          style={{ minHeight: 44 }}
          onClick={() => setReplying(true)}
        >
          <Icon name="message" size={17} weight={2} />
          {notes.length === 0 ? `Ask ${COACH.name}` : `Reply to ${COACH.name}`}
        </button>
      )}
    </div>
  )
}
