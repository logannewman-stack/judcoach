import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { useStore } from '../../store/useStore'
import { ANCHOR_LABEL } from '../../domain/coach'
import type { AnchorKind, NoteAnchor } from '../../domain/coach'
import { getExercise } from '../../data/exercises'
import { formatMediumDate } from '../../lib/date'
import { useNav } from '../../nav/nav'

/* ============================================================================
   What a message is attached to, resolved into something you can name and open.
   ========================================================================== */

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
      open: log ? () => { switchTab('train'); push('logDetail', { logId: log.id }) } : undefined,
    }
  }
  if (anchor.kind === 'weighIn') {
    const entry = weighIns.find((w) => w.date === anchor.id)
    return {
      ...base,
      title: entry
        ? `${entry.weight} ${units} · ${formatMediumDate(entry.date)}`
        : formatMediumDate(anchor.id),
      open: () => switchTab('weigh'),
    }
  }
  if (anchor.kind === 'checkIn') {
    return {
      ...base,
      title: 'Weekly check-in',
      open: () => { switchTab('weigh'); push('checkIns') },
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
