import { CoachAvatar } from './Bits'
import { Icon } from './Icon'
import { useCoach } from '../store/coach'
import { useStore } from '../store/useStore'
import { byTime, unreadFrom } from '../domain/coach'
import { ANCHOR_ICON, useAnchorTarget } from '../screens/coach/anchor'
import { COACH } from '../data/seed'
import { useNav } from '../nav/nav'

/* ============================================================================
   What the other side has said, on the first screen of the app.

   Messages used to live three taps into Settings, which is no place for the one
   thing in a coaching app that is actually addressed to you. This shows the
   newest one where it will be seen, and opens the record it is about rather
   than a conversation you then have to read backwards.
   ========================================================================== */

const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function CoachCard() {
  const notes = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const clientName = useStore((s) => s.profile.name)
  const push = useNav((s) => s.push)
  const switchTab = useNav((s) => s.switchTab)

  const unread = unreadFrom(notes, viewAs)
  const newest = byTime(unread).at(-1) ?? byTime(notes.filter((n) => n.author !== viewAs)).at(-1)
  const target = useAnchorTarget(newest?.anchor ?? { kind: 'thread' })

  const them = viewAs === 'client' ? COACH.name : (clientName.split(' ')[0] || 'your client')
  const themFull = viewAs === 'client' ? COACH.fullName : clientName

  const openThread = () => { switchTab('settings'); push('messages') }

  // Nothing has ever been said: the profile card is still the right thing.
  if (!newest) {
    return (
      <button type="button" className="card coach-card" onClick={openThread}>
        <CoachAvatar size={44} name={themFull} />
        <span className="coach-card-body">
          <span className="t-headline">{themFull}</span>
          <span className="t-footnote dim truncate">{COACH.title} · {COACH.credentials}</span>
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
          <span className="t-caption1 dim">{ago(newest.sentAt)}</span>
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
