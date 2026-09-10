import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { CoachAvatar } from '../../components/Bits'
import { ActionSheet } from '../../components/ios/Sheet'
import { Icon } from '../../components/Icon'
import { useCoach } from '../../store/coach'
import { useStore } from '../../store/useStore'
import { anchorKey, byTime, groupNotes, unreadFrom } from '../../domain/coach'
import type { CoachAuthor, CoachNote, NoteGroup } from '../../domain/coach'
import { COACH } from '../../data/seed'
import { formatMediumDate, relativeDay, todayISO } from '../../lib/date'
import { AnchorCard } from './anchor'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'
import { Composer } from './Composer'

/* ============================================================================
   The conversation, from whichever seat the app is currently in.

   A message can stand alone or be attached to one specific record. An attached
   one carries a card naming what it is about, which opens the record — so "you
   had one more rep in that" is one tap from the set it is talking about.
   ========================================================================== */

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function Messages() {
  const pop = useNav((s) => s.pop)
  const notes = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const send = useCoach((s) => s.send)
  const remove = useCoach((s) => s.remove)
  const markRead = useCoach((s) => s.markRead)
  const clientName = useStore((s) => s.profile.name)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [acting, setActing] = useState<CoachNote | null>(null)

  const them = viewAs === 'client' ? COACH.name : (clientName.split(' ')[0] || 'your client')
  const themFull = viewAs === 'client' ? COACH.fullName : clientName

  /* The line the newest unread sits under, frozen on entry so it does not jump
     out from under the reader the instant the screen marks itself read. */
  const firstUnread = useMemo(
    () => byTime(unreadFrom(notes, viewAs))[0]?.id,
    // Deliberately only on arrival and on switching seats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewAs],
  )

  // Opening the thread is reading it. Changing seats while it is already open
  // is not: that would consume the other side's unread badge before it showed.
  const enteredAs = useRef(viewAs)
  useEffect(() => {
    if (enteredAs.current !== viewAs) return
    markRead()
  }, [markRead, viewAs])

  const days = useMemo(() => byDay(notes, viewAs), [notes, viewAs])
  const count = notes.length

  // Land at the newest message the way a messages app does, without animating
  // the whole history past on the way in.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [viewAs])

  // Afterwards, follow new messages only if the reader is already at the end.
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    // atBottom is read, not tracked: a new message should not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  const toBottom = (smooth = true) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  return (
    <Screen
      title={them}
      inlineTitle
      back={{ onPress: pop }}
      scrollRef={scrollRef}
      // The composer already separates the thread from the tab bar; the usual
      // bottom pad would leave the newest message stranded above it.
      padBottom={false}
      onScroll={(top, el) => setAtBottom(el.scrollHeight - top - el.clientHeight < 48)}
      footer={
        <Composer
          placeholder={`Message ${them}`}
          onSend={(body) => {
            send({ kind: 'thread' }, body)
            haptic('light')
            requestAnimationFrame(() => toBottom())
          }}
        />
      }
    >
      <div className="thread">
        <ThreadIntro name={themFull} caption={viewAs === 'client' ? COACH.responseWindow : 'Block 3 · week 5 of 8'} />
        {days.map(({ date, groups }, di) => (
          <div key={date} style={{ display: 'contents' }}>
            <div className="thread-day">{dayLabel(date)}</div>
            {groups.map((group, i) => (
              <Group
                key={`${date}-${i}`}
                group={group}
                outgoing={group.author === viewAs}
                // The card names what a run of messages is about, so it belongs
                // once at the top of that run rather than above every reply.
                showCard={group.showCard}
                newFrom={firstUnread}
                onHold={(note) => note.author === viewAs && setActing(note)}
                delivered={
                  group.author === viewAs
                  && di === days.length - 1
                  && i === groups.length - 1
                }
              />
            ))}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button
            type="button"
            className="jump-latest"
            aria-label="Jump to the newest message"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            onClick={() => toBottom()}
          >
            <Icon name="chevron.down" size={17} weight={2.6} />
          </motion.button>
        )}
      </AnimatePresence>

      <ActionSheet
        open={acting != null}
        onClose={() => setActing(null)}
        items={[
          { label: 'Copy', onPress: () => { navigator.clipboard?.writeText(acting?.body ?? '') } },
          {
            label: 'Delete message',
            destructive: true,
            onPress: () => { if (acting) remove(acting.id) },
          },
        ]}
      />
    </Screen>
  )
}

/** Who you are talking to, above the first message. */
function ThreadIntro({ name, caption }: { name: string; caption: string }) {
  return (
    <div className="thread-intro">
      <CoachAvatar size={62} name={name} />
      <div style={{ textAlign: 'center' }}>
        <div className="t-headline">{name}</div>
        <div className="t-caption1 dim" style={{ marginTop: 1 }}>{caption}</div>
      </div>
    </div>
  )
}

function Group({
  group, outgoing, showCard, delivered, newFrom, onHold,
}: {
  group: NoteGroup
  outgoing: boolean
  showCard?: boolean
  delivered?: boolean
  newFrom?: string
  onHold: (note: CoachNote) => void
}) {
  const last = group.notes.at(-1)!
  return (
    <>
      {group.notes.some((n) => n.id === newFrom) && (
        <div className="thread-new"><span>New</span></div>
      )}
      <div className="msg-group" data-from={outgoing ? 'me' : 'them'}>
        {showCard && <AnchorCard anchor={group.notes[0]!.anchor} />}
        {group.notes.map((note, i) => (
          <Bubble
            key={note.id}
            note={note}
            tail={i === group.notes.length - 1}
            onHold={() => onHold(note)}
          />
        ))}
        <div className="msg-meta">
          {time(last.sentAt)}
          {delivered && (last.readAt ? ' · Read' : ' · Delivered')}
        </div>
      </div>
    </>
  )
}

function Bubble({ note, tail, onHold }: { note: CoachNote; tail: boolean; onHold: () => void }) {
  const timer = useRef<number>()
  const hold = () => { timer.current = window.setTimeout(() => { haptic('medium'); onHold() }, 450) }
  const release = () => window.clearTimeout(timer.current)

  return (
    <motion.div
      className={`bubble${tail ? ' tail' : ''}`}
      layout="position"
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 560, damping: 36, mass: 0.7 }}
      onPointerDown={hold}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {note.body}
      {note.highlight && (
        <div className="msg-highlight">
          <span>{note.highlight.label}</span>
          <span className="msg-highlight-value">{note.highlight.value}</span>
        </div>
      )}
    </motion.div>
  )
}

/* -------------------------------- grouping -------------------------------- */

interface DayGroup extends NoteGroup {
  /** True when this group starts a new run about a different record. */
  showCard: boolean
}

function byDay(notes: CoachNote[], viewer: CoachAuthor): { date: string; groups: DayGroup[] }[] {
  const days = new Map<string, CoachNote[]>()
  for (const note of byTime(notes)) {
    const date = note.sentAt.slice(0, 10)
    const bucket = days.get(date)
    if (bucket) bucket.push(note)
    else days.set(date, [note])
  }
  // A run continues across a day break, so the key is tracked outside the loop.
  let previousAnchor = 'thread'
  void viewer
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
