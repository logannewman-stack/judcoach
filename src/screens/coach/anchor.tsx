import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { useStore } from '../../store/useStore'
import { ANCHOR_LABEL } from '../../domain/coach'
import type { AnchorKind, CoachAuthor, NoteAnchor } from '../../domain/coach'
import { getExercise } from '../../data/exercises'
import { COACH } from '../../data/seed'
import { formatMediumDate } from '../../lib/date'
import { num } from '../../lib/format'
import { useNav } from '../../nav/nav'

/* ============================================================================
   What a message is attached to, resolved into something you can name and open
   — and who the two people talking about it are.
   ========================================================================== */

/* ------------------------------- who is who ------------------------------- */

/**
 * The other side of the conversation, from the seat the app is currently in.
 *
 * `short` is what a byline or a placeholder says; `full` is how a header
 * introduces someone. They are separate because the full form also feeds
 * `CoachAvatar`, which draws the first letter of whatever it is handed — a
 * client with no name on file left a blank accent disc under an empty headline.
 */
export function otherParty(viewAs: CoachAuthor, clientName: string): { short: string; full: string } {
  if (viewAs === 'client') return { short: COACH.name, full: COACH.fullName }
  const named = clientName.trim()
  return { short: named.split(' ')[0] || 'your client', full: named || 'Your client' }
}

/**
 * What to call a message's author.
 *
 * Keyed off the author, not off the seat: `author === viewAs ? 'You' : COACH.name`
 * collapsed two people into one, so in Jud's seat every message the client had
 * written came out over Jud's name.
 */
export function authorName(author: CoachAuthor, viewAs: CoachAuthor, clientName: string): string {
  if (author === viewAs) return 'You'
  if (author === 'coach') return COACH.name
  return clientName.trim().split(' ')[0] || 'Client'
}

/* -------------------------------- anchors -------------------------------- */

export const ANCHOR_ICON: Record<AnchorKind, IconName> = {
  thread: 'message',
  workout: 'dumbbell',
  weighIn: 'scale',
  checkIn: 'note',
  photo: 'photo',
  exercise: 'book',
}

export interface AnchorTarget {
  kind: AnchorKind
  label: string
  title: string
  open?: () => void
}

export function useAnchorTarget(anchor: NoteAnchor): AnchorTarget {
  const push = useNav((s) => s.push)
  const switchTab = useNav((s) => s.switchTab)
  const logs = useStore((s) => s.logs)
  const weighIns = useStore((s) => s.weighIns)
  const units = useStore((s) => s.profile.units)

  const base = { kind: anchor.kind, label: ANCHOR_LABEL[anchor.kind] }

  if (anchor.kind === 'thread') return { ...base, title: 'Message' }

  if (anchor.kind === 'workout') {
    const log = logs.find((l) => l.id === anchor.id)
    return {
      ...base,
      title: log ? `${log.sessionName} · ${formatMediumDate(log.date)}` : 'No longer in your history',
      open: log
        ? () => { switchTab('train'); push('logDetail', { logId: log.id, focus: 'notes' }) }
        : undefined,
    }
  }
  if (anchor.kind === 'weighIn') {
    const entry = weighIns.find((w) => w.date === anchor.id)
    return {
      ...base,
      title: entry
        ? `${num(entry.weight, 1)} ${units} · ${formatMediumDate(entry.date)}`
        : formatMediumDate(anchor.id),
      open: () => switchTab('weigh'),
    }
  }
  if (anchor.kind === 'checkIn') {
    return {
      ...base,
      title: 'Weekly check-in',
      open: () => { switchTab('weigh'); push('checkIns', { focus: 'notes' }) },
    }
  }
  if (anchor.kind === 'photo') {
    return { ...base, title: 'Progress photo', open: () => { switchTab('weigh'); push('photos') } }
  }
  return {
    ...base,
    title: getExercise(anchor.id)?.name ?? 'Movement',
    open: () => { switchTab('train'); push('exerciseDetail', { exerciseId: anchor.id }) },
  }
}

/** The record a message is about, as a card that opens it. */
export function AnchorCard({ anchor }: { anchor: NoteAnchor }) {
  const target = useAnchorTarget(anchor)
  if (anchor.kind === 'thread') return null

  const inner = (
    <>
      <span className="msg-card-icon">
        <Icon name={ANCHOR_ICON[anchor.kind]} size={17} weight={2} color="var(--accent)" />
      </span>
      <span className="msg-card-body">
        <span className="msg-card-kind">{target.label}</span>
        <span className="msg-card-title truncate">{target.title}</span>
      </span>
      {target.open && <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />}
    </>
  )

  if (!target.open) return <div className="msg-card">{inner}</div>
  return (
    <button type="button" className="msg-card" onClick={target.open} aria-label={`Open ${target.title}`}>
      {inner}
    </button>
  )
}
