import { CoachAvatar } from './Bits'
import { Icon } from './Icon'
import { useCoach } from '../store/coach'
import { useStore } from '../store/useStore'
import { byTime, unreadFrom } from '../domain/coach'
import { ANCHOR_ICON, otherParty, useAnchorTarget } from '../screens/coach/anchor'
import { COACH } from '../data/seed'
import { relativeTime } from '../lib/date'
import { useNav } from '../nav/nav'

/* ============================================================================
   What the other side has said, on the first screen of the app.

   Messages used to live three taps into Settings, which is no place for the one
   thing in a coaching app that is actually addressed to you. This shows the
   newest one where it will be seen, and opens the record it is about rather
   than a conversation you then have to read backwards.
   ========================================================================== */

export function CoachCard() {
  const notes = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const clientName = useStore((s) => s.profile.name)
  const push = useNav((s) => s.push)
  const switchTab = useNav((s) => s.switchTab)

  const unread = unreadFrom(notes, viewAs)
  const newest = byTime(unread).at(-1) ?? byTime(notes.filter((n) => n.author !== viewAs)).at(-1)
  const target = useAnchorTarget(newest?.anchor ?? { kind: 'thread' })

  const { short: them, full: themFull } = otherParty(viewAs, clientName)

  const openThread = () => { switchTab('settings'); push('messages') }

  /* Nothing has come back from the other side. The card still introduces them,
     but an introduction alone is a profile row: this is the only place on the
     first screen from which the conversation can start, so it has to say so.
     Which line depends on whose move it is — "Say hello" to somebody already
     waiting on a reply would be the app not reading its own thread. */
  if (!newest) {
    const waiting = notes.some((n) => n.author === viewAs)
    return (
      <button type="button" className="card coach-card" onClick={openThread}>
        <CoachAvatar size={44} name={themFull} />
        <span className="coach-card-body">
          <span className="t-headline">{themFull}</span>
          {/* Jud's credentials are Jud's. In his seat the other party is the
              client, and the line under their name has to be theirs. */}
          {viewAs === 'client' && (
            <span className="t-footnote dim truncate">{COACH.title} · {COACH.credentials}</span>
          )}
          {waiting ? (
            <span className="t-footnote dim">Sent &middot; no reply yet</span>
          ) : (
            <span className="t-footnote" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Say hello
            </span>
          )}
        </span>
        <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
      </button>
    )
  }

  const anchored = newest.anchor.kind !== 'thread'
  return (
    <div className="card coach-card-full" data-unread={unread.length > 0}>
      <button
        type="button"
        className="coach-card-head"
        onClick={openThread}
        aria-label={`Open your conversation with ${them}`}
      >
        <CoachAvatar size={38} name={themFull} />
        <span className="coach-card-body">
          <span className="coach-card-name">
            {them}
            {unread.length > 0 && <span className="note-unread" />}
          </span>
          {/* The app's one relative-time rule. The copy here counted in 24-hour
              blocks, so a message sent thirty hours ago read "yesterday". */}
          <span className="t-caption1 dim">{relativeTime(newest.sentAt).label}</span>
        </span>
        {unread.length > 1 && <span className="t-caption1 dim">{unread.length} new</span>}
        <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
      </button>

      <p className="coach-card-quote">{newest.body}</p>

      {anchored && target.open && (
        <button type="button" className="msg-card" onClick={target.open}>
          <span className="msg-card-icon">
            <Icon name={ANCHOR_ICON[newest.anchor.kind]} size={17} weight={2} color="var(--accent)" />
          </span>
          <span className="msg-card-body">
            <span className="msg-card-kind">{target.label}</span>
            <span className="msg-card-title truncate">{target.title}</span>
          </span>
          <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />
        </button>
      )}
    </div>
  )
}
