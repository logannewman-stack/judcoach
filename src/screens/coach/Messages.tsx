import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { CoachAvatar } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { useCoach } from '../../store/coach'
import { useStore } from '../../store/useStore'
import { ANCHOR_LABEL, anchorKey, groupNotes, byTime } from '../../domain/coach'
import type { AnchorKind, CoachNote, NoteAnchor, NoteGroup } from '../../domain/coach'
import { COACH } from '../../data/seed'
import { getExercise } from '../../data/exercises'
import { formatMediumDate, relativeDay, todayISO } from '../../lib/date'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

/* ============================================================================
   The conversation with Jud.

   Reads as one thread whether a message stands alone or is attached to a
   session, a weigh-in or a photo. An attached one carries a card naming what it
   is about, which opens the record — so "you had one more rep in that" is one
   tap from the set it is talking about.
   ========================================================================== */

const ANCHOR_ICON: Record<AnchorKind, IconName> = {
  thread: 'message',
  workout: 'dumbbell',
  weighIn: 'scale',
  checkIn: 'note',
  photo: 'photo',
  exercise: 'book',
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function Messages() {
  const pop = useNav((s) => s.pop)
  const notes = useCoach((s) => s.notes)
  const send = useCoach((s) => s.send)
  const markRead = useCoach((s) => s.markRead)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')

  // Opening the thread is reading it. Run once per visit, not per keystroke.
  useEffect(() => { markRead() }, [markRead])

  const days = useMemo(() => byDay(notes), [notes])

  // Land at the newest message the way a messages app does, without animating
  // the whole history past on the way.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [days.length])

  const submit = () => {
    const body = draft.trim()
    if (!body) return
    send({ kind: 'thread' }, body)
    setDraft('')
    haptic('light')
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <Screen
      title={COACH.name}
      inlineTitle
      back={{ onPress: pop }}
      scrollRef={scrollRef}
      // The compose bar already separates the thread from the tab bar; the
      // usual bottom pad would leave the newest message stranded above it.
      padBottom={false}
      footer={
        <div className="compose">
          <textarea
            className="compose-field"
            value={draft}
            rows={1}
            placeholder={`Message ${COACH.name}`}
            aria-label={`Message ${COACH.name}`}
            onChange={(e) => {
              setDraft(e.target.value)
              // Grow with the text, up to the CSS max-height.
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <button
            type="button"
            className="compose-send"
            disabled={draft.trim().length === 0}
            aria-label="Send"
            onClick={submit}
          >
            <Icon name="send.fill" size={19} weight={2.6} />
          </button>
        </div>
      }
    >
      <div className="thread">
        <CoachIntro />
        {days.map(({ date, groups }, di) => (
          <div key={date} style={{ display: 'contents' }}>
            <div className="thread-day">{dayLabel(date)}</div>
            {groups.map((group, i) => (
              <Group
                key={`${date}-${i}`}
                group={group}
                // The card names what a run of messages is about, so it belongs
                // once at the top of that run rather than above every reply.
                showCard={group.showCard}
                // Only the very last thing said, and only if it was the client.
                delivered={
                  group.author === 'client'
                  && di === days.length - 1
                  && i === groups.length - 1
                }
              />
            ))}
          </div>
        ))}
      </div>
    </Screen>
  )
}

/** Who you are talking to, above the first message. */
function CoachIntro() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '6px 0 2px' }}>
      <CoachAvatar size={62} />
      <div style={{ textAlign: 'center' }}>
        <div className="t-headline">{COACH.fullName}</div>
        <div className="t-caption1 dim" style={{ marginTop: 1 }}>{COACH.responseWindow}</div>
      </div>
    </div>
  )
}

function Group({
  group, showCard, delivered,
}: { group: NoteGroup; showCard?: boolean; delivered?: boolean }) {
  const last = group.notes.at(-1)!
  return (
    <div className="msg-group" data-from={group.author}>
      {showCard && <AnchorCard anchor={group.notes[0]!.anchor} />}
      {group.notes.map((note, i) => (
        <Bubble key={note.id} note={note} tail={i === group.notes.length - 1} />
      ))}
      <div className="msg-meta">
        {time(last.sentAt)}
        {delivered && ' · Delivered'}
      </div>
    </div>
  )
}

function Bubble({ note, tail }: { note: CoachNote; tail: boolean }) {
  return (
    <>
      <div className={`bubble${tail ? ' tail' : ''}`}>
        {note.body}
        {note.highlight && (
          <div className="msg-highlight">
            <span>{note.highlight.label}</span>
            <span className="msg-highlight-value">{note.highlight.value}</span>
          </div>
        )}
      </div>
    </>
  )
}

/** The record a message is about, as a card that opens it. */
export function AnchorCard({ anchor }: { anchor: NoteAnchor }) {
  const push = useNav((s) => s.push)
  const switchTab = useNav((s) => s.switchTab)
  const logs = useStore((s) => s.logs)
  const weighIns = useStore((s) => s.weighIns)

  if (anchor.kind === 'thread') return null

  let title = ANCHOR_LABEL[anchor.kind]
  let open: (() => void) | undefined

  if (anchor.kind === 'workout') {
    const log = logs.find((l) => l.id === anchor.id)
    title = log ? `${log.sessionName} · ${formatMediumDate(log.date)}` : 'Workout no longer in your history'
    if (log) open = () => { switchTab('train'); push('logDetail', { logId: log.id }) }
  } else if (anchor.kind === 'weighIn') {
    const entry = weighIns.find((w) => w.date === anchor.id)
    title = entry ? `${entry.weight} lb · ${formatMediumDate(entry.date)}` : formatMediumDate(anchor.id)
    open = () => switchTab('weigh')
  } else if (anchor.kind === 'checkIn') {
    title = 'Weekly check-in'
    open = () => { switchTab('weigh'); push('checkIns') }
  } else if (anchor.kind === 'photo') {
    title = 'Progress photo'
    open = () => { switchTab('weigh'); push('photos') }
  } else if (anchor.kind === 'exercise') {
    const exercise = getExercise(anchor.id)
    title = exercise?.name ?? 'Movement'
    open = () => { switchTab('train'); push('exerciseDetail', { exerciseId: anchor.id }) }
  }

  const inner = (
    <>
      <span className="msg-card-icon">
        <Icon name={ANCHOR_ICON[anchor.kind]} size={17} weight={2} color="var(--accent)" />
      </span>
      <span className="msg-card-body">
        <span className="msg-card-kind" style={{ display: 'block' }}>{ANCHOR_LABEL[anchor.kind]}</span>
        <span className="msg-card-title truncate" style={{ display: 'block' }}>{title}</span>
      </span>
      {open && <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />}
    </>
  )

  if (!open) return <div className="msg-card">{inner}</div>
  return (
    <button type="button" className="msg-card" onClick={open} aria-label={`Open ${title}`}>
      {inner}
    </button>
  )
}

/* -------------------------------- grouping -------------------------------- */

interface DayGroup extends NoteGroup {
  /** True when this group starts a new run about a different record. */
  showCard: boolean
}

function byDay(notes: CoachNote[]): { date: string; groups: DayGroup[] }[] {
  const days = new Map<string, CoachNote[]>()
  for (const note of byTime(notes)) {
    const date = note.sentAt.slice(0, 10)
    const bucket = days.get(date)
    if (bucket) bucket.push(note)
    else days.set(date, [note])
  }
  // The run continues across the day break, so the key is tracked outside it.
  let previousAnchor = 'thread'
  return [...days.entries()].map(([date, forDay]) => ({
    date,
    groups: groupNotes(forDay).map((group) => {
      const key = anchorKey(group.notes[0]!.anchor)
      const showCard = key !== 'thread' && key !== previousAnchor
      previousAnchor = key
      return { ...group, showCard }
    }),
  }))
}

function dayLabel(date: string): string {
  const relative = relativeDay(date, todayISO())
  return relative === date ? formatMediumDate(date) : relative
}
