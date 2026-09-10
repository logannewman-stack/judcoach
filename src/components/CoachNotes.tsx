import { useEffect, useMemo, useRef, useState } from 'react'
import { CoachAvatar } from './Bits'
import { Icon } from './Icon'
import { useCoach, notesFor } from '../store/coach'
import { useStore } from '../store/useStore'
import type { NoteAnchor } from '../domain/coach'
import { COACH } from '../data/seed'
import { formatMediumDate } from '../lib/date'
import { haptic } from '../lib/haptics'
import { toast } from './ios/Toast'
import { useNav } from '../nav/nav'
import { Composer } from '../screens/coach/Composer'

/* ============================================================================
   The conversation about one record, shown on the record itself.

   The same messages as the thread, put where they are useful: a note about a
   set sits under that set rather than twelve screens back. Replying from here
   lands in the thread, so there is still only one conversation.
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
  /** Shown when nothing has been said about this record yet. */
  empty,
  /**
   * Set when the screen was opened *because* of these notes. The record they
   * are about is usually a long scroll, so arriving at the top of it and
   * hunting for the comment you tapped is the wrong end of the journey.
   */
  spotlight,
}: {
  anchor: NoteAnchor
  empty?: string
  spotlight?: boolean
}) {
  const all = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const send = useCoach((s) => s.send)
  const markRead = useCoach((s) => s.markRead)
  const clientName = useStore((s) => s.profile.name)
  const push = useNav((s) => s.push)
  const notes = useMemo(() => notesFor(all, anchor), [all, anchor])
  const [replying, setReplying] = useState(false)
  const strip = useRef<HTMLDivElement>(null)

  const key = anchor.kind === 'thread' ? 'thread' : anchor.id
  const them = viewAs === 'client' ? COACH.name : (clientName.split(' ')[0] || 'your client')
  const unread = notes.some((n) => n.author !== viewAs && !n.readAt)

  // Seeing a note is reading it, but only once the record is actually open —
  // and only by the seat that opened it. Changing seats on a screen already
  // showing the note would eat the other side's unread badge before it showed.
  const enteredAs = useRef(viewAs)
  useEffect(() => {
    if (unread && enteredAs.current === viewAs) markRead(anchor)
    // The anchor object is rebuilt each render; its kind and id are its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, markRead, viewAs, anchor.kind, key])

  useEffect(() => {
    if (!spotlight) return
    // After the push settles, or the animation carries it back out of view.
    const id = window.setTimeout(
      () => strip.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      420,
    )
    return () => window.clearTimeout(id)
  }, [spotlight])

  const label = (author: string) => (author === viewAs
    ? 'You'
    : viewAs === 'client' ? COACH.name : (clientName.split(' ')[0] || 'Client'))

  if (notes.length === 0 && !empty) return null

  return (
    <div className={`note-strip${spotlight ? ' spotlight' : ''}`} ref={strip}>
      {notes.length === 0 ? (
        <div className="t-footnote dim" style={{ padding: '2px 2px 0' }}>{empty}</div>
      ) : (
        notes.map((note) => {
          const mine = note.author === viewAs
          return (
            <div key={note.id} className="note" data-from={mine ? 'me' : 'them'}>
              {!mine && <CoachAvatar size={30} name={label(note.author)} />}
              <div className="note-body">
                <div className="note-name">
                  {label(note.author)} · {relative(note.sentAt)}
                  {!mine && !note.readAt && <span className="note-unread" />}
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
          )
        })
      )}

      {replying ? (
        <Composer
          compact
          autoFocus
          placeholder={`Reply to ${them}`}
          onCancel={() => setReplying(false)}
          onSend={(body) => {
            send(anchor, body)
            setReplying(false)
            haptic('light')
            toast('Sent', { icon: 'check.circle.fill', tone: 'good' })
          }}
        />
      ) : (
        <div className="note-actions">
          <button
            type="button"
            className="btn btn-gray note-reply"
            onClick={() => setReplying(true)}
          >
            <Icon name="message" size={17} weight={2} />
            {notes.length === 0 ? `Ask ${them}` : `Reply to ${them}`}
          </button>
          {notes.length > 0 && (
            <button
              type="button"
              className="btn btn-gray note-open"
              aria-label="Open the full conversation"
              onClick={() => push('messages')}
            >
              <Icon name="arrow.right" size={17} weight={2.2} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
