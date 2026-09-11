import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row, rowSepInset } from '../../components/ios/List'
import { Card, CoachNote } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { flushSection } from './parts'
import { resolvePrescription, topPrescribedSet } from './prescription'
import { useStore } from '../../store/useStore'
import {
  currentWeekIndex, getWeek, logSetCount, useProgram, weekSchedule, sessionsThisWeek,
} from '../../store/selectors'
import type { Profile, Program, SessionTemplate, WorkoutLog } from '../../domain/types'
import { EXERCISES, MAIN_LIFTS, getExercise } from '../../data/exercises'
import { formatMinutes, formatShortDate, todayISO, weekdayShortFromDow } from '../../lib/date'
import { num, pluralize } from '../../lib/format'
import { navPresent, useNav } from '../../nav/nav'

/* Wide enough for a three-letter weekday over a two-digit date. The row's
   separator has to start from the same column, which is what `sepInset` says. */
const DATE_BADGE_W = 34

export function TrainHome() {
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const active = useStore((s) => s.active)
  const blockStartedOn = useStore((s) => s.blockStartedOn)
  const push = useNav((s) => s.push)

  const liveWeek = currentWeekIndex(program, today)
  const [weekIndex, setWeekIndex] = useState(liveWeek)
  // The block rolling into a new week — or a client starting a fresh one — has
  // to move the selection with it, or the screen goes on showing last week
  // while the header above it says "current".
  const [shownLive, setShownLive] = useState(liveWeek)
  if (shownLive !== liveWeek) {
    setShownLive(liveWeek)
    setWeekIndex(liveWeek)
  }

  const week = getWeek(program, weekIndex)
  const schedule = useMemo(() => weekSchedule(program, weekIndex, logs), [program, weekIndex, logs])
  const progress = sessionsThisWeek(program, logs, today)
  const shape = useMemo(() => blockShape(program, logs, profile), [program, logs, profile])

  // The one action this screen exists for, and only while it means anything:
  // browsing week two in February is not an invitation to train.
  const dueToday = weekIndex === liveWeek && !active
    ? schedule.find((s) => s.date === today && !s.log)
    : undefined

  // Until these exist the block is a page of percentages, so they outrank
  // "Start workout" here for the same reason they do on Today.
  const maxesSet = MAIN_LIFTS.filter((l) => (profile.trainingMaxes[l.id] ?? 0) > 0).length
  const needsMaxes = maxesSet < MAIN_LIFTS.length

  return (
    <Screen
      title="Train"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim truncate">{program.name}</div>
        </div>
      }
      right={{ icon: 'calendar', onPress: () => push('history'), ariaLabel: 'Workout history' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ---------------------------- the block ----------------------------- */}
        <BlockStrip shape={shape} selected={weekIndex} live={liveWeek} onSelect={setWeekIndex} />

        {/* ----------------------------- week header -------------------------- */}
        {week && (
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="eyebrow">Week {week.index} of {program.weeks.length}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                <h2 className="t-title2">{week.label.split(' — ')[1]}</h2>
                {week.deload && <Pill tone="tinted">Deload</Pill>}
                {/* Which week you are on is a fact, not a verdict, so it does
                    not borrow the green that means "on target" — DESIGN.md §2. */}
                {weekIndex === liveWeek && <Pill>This week</Pill>}
              </div>
              {weekIndex === liveWeek && (
                <div className="t-footnote dim" style={{ marginTop: 3 }}>
                  <span className="data">{progress.done}/{progress.total}</span> sessions done
                </div>
              )}
            </div>
            <CoachNote>{week.emphasis}</CoachNote>
          </div>
        )}

        {/* --------------------------- primary action ------------------------- */}
        {needsMaxes ? (
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Button icon="chart.bar" onPress={() => push('trainingMaxes')}>
              Set your working maxes
            </Button>
            <p className="t-caption1 dim" style={{ margin: '5px 0 1px' }}>
              <span className="data">{maxesSet}</span> of{' '}
              <span className="data">{MAIN_LIFTS.length}</span> on file. Every load below is a
              share of them, which is why the sessions read in percentages.
            </p>
            {dueToday && (
              <Button
                variant="plain"
                onPress={() => navPresent('runner', { weekIndex, sessionId: dueToday.session.id })}
                style={{ fontSize: 'calc(15 * var(--pt))' }}
              >
                Start workout anyway
              </Button>
            )}
          </div>
        ) : dueToday ? (
          <div className="gutter">
            <Button
              icon="play.fill"
              onPress={() => navPresent('runner', { weekIndex, sessionId: dueToday.session.id })}
            >
              Start workout
            </Button>
          </div>
        ) : null}

        {/* ------------------------------ sessions ---------------------------- */}
        <ListSection header="Sessions" style={flushSection}>
          {schedule.map(({ session, date, log }) => {
            const isToday = date === today
            // A session scheduled before the client's first day was never
            // theirs to miss, which is the same floor Today's catch-up uses.
            const isMissed = date < today && (!blockStartedOn || date >= blockStartedOn)

            return (
              <Row
                key={session.id}
                sepInset={rowSepInset(DATE_BADGE_W)}
                leading={
                  <span
                    aria-hidden="true"
                    style={{
                      width: DATE_BADGE_W,
                      flex: 'none',
                      textAlign: 'center',
                      color: log ? 'var(--green-text)' : isToday ? 'var(--accent)' : 'var(--label-2)',
                    }}
                  >
                    <span className="eyebrow" style={{ display: 'block', color: 'inherit' }}>
                      {weekdayShortFromDow(session.weekday)}
                    </span>
                    <span className="data" style={{ display: 'block', fontSize: 'calc(17 * var(--pt))', lineHeight: 1.235294 }}>
                      {formatShortDate(date).split(' ')[1]}
                    </span>
                  </span>
                }
                title={session.name}
                // One line. A row that says the focus, then the opener, then how
                // long it took is three lines of subtitle pretending to be two.
                subtitle={
                  <span className="truncate" style={{ display: 'block' }}>
                    {log ? <LoggedLine log={log} /> : <PlannedLine session={session} profile={profile} />}
                  </span>
                }
                trailing={
                  log ? (
                    <Icon name="check.circle.fill" size={17} color="var(--green)" />
                  ) : isToday ? (
                    <Pill tone="tinted">Today</Pill>
                  ) : isMissed ? (
                    <Icon name="clock" size={15} color="var(--orange)" weight={2.2} />
                  ) : undefined
                }
                chevron
                onPress={() => push('session', { weekIndex, sessionId: session.id })}
              />
            )
          })}
        </ListSection>

        {/* ------------------------------- toolbox ---------------------------- */}
        <ListSection header="Reference" style={flushSection}>
          <Row
            title="Exercise library"
            subtitle={<span className="data">{pluralize(EXERCISES.length, 'movement')}</span>}
            icon="book"
            iconColor="var(--indigo)"
            chevron
            onPress={() => push('exerciseLibrary')}
          />
          <Row
            title="RPE & RIR chart"
            subtitle="What each number means, and the percentages behind it"
            icon="target"
            iconColor="var(--orange)"
            chevron
            onPress={() => push('rpeGuide')}
          />
          <Row
            title="Personal records"
            icon="seal.fill"
            iconColor="var(--yellow)"
            chevron
            onPress={() => push('prs')}
          />
          <Row
            title="Workout history"
            value={<span className="data">{logs.length}</span>}
            icon="calendar"
            iconColor="var(--green)"
            chevron
            onPress={() => push('history')}
          />
          <Row
            title="Working maxes"
            subtitle="Drives every percentage in the block"
            value={<span className="data">{maxesSet}/{MAIN_LIFTS.length}</span>}
            icon="chart.bar"
            iconColor="var(--blue)"
            chevron
            onPress={() => push('trainingMaxes')}
          />
        </ListSection>

        <div className="gutter">
          <Card>
            <div className="t-footnote dim" style={{ lineHeight: 1.384615 }}>
              <span className="semibold" style={{ color: 'var(--label)' }}>Goal: </span>
              {program.goal}
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  )
}

/* -------------------------------- the block ------------------------------ */

interface WeekShape {
  index: number
  /** "Accumulation", "Deload" — the week's name, for the cell's spoken label. */
  label: string
  /** Heaviest share of the training max the week's main lift asks for. */
  percent: number
  /** The effort that set is prescribed at; absent on a deload, which makes no
      claim about how hard it should feel. */
  rpe?: number
  done: number
  total: number
}

/**
 * What the block does, week by week.
 *
 * Eight weeks of programming have a shape — three building, a deload, four
 * sharpening to a peak — and it is the single most useful thing about them.
 * Read off the main lift, because that is where a block's intent lives; the
 * accessories follow it.
 */
function blockShape(program: Program, logs: WorkoutLog[], profile: Profile): WeekShape[] {
  return program.weeks.map((week) => {
    let percent = 0
    let rpe: number | undefined
    for (const session of week.sessions) {
      const main = session.blocks[0]
      if (!main) continue
      for (const set of resolvePrescription(main, profile)) {
        if ((set.percent ?? 0) > percent) {
          percent = set.percent!
          rpe = set.rpe
        }
      }
    }
    return {
      index: week.index,
      label: week.label.split(' — ')[1] ?? week.label,
      percent,
      rpe,
      done: week.sessions.filter((s) => logs.some((l) => l.sessionId === s.id)).length,
      total: week.sessions.length,
    }
  })
}

function BlockStrip({
  shape, selected, live, onSelect,
}: {
  shape: WeekShape[]
  selected: number
  live: number
  onSelect: (index: number) => void
}) {
  const loads = shape.map((w) => w.percent)
  const top = Math.max(...loads)
  const floor = Math.min(...loads)
  // Scaled against the block's own range rather than zero: every week of a
  // strength block sits between 60% and 95% of a max, and a bar chart anchored
  // at zero would draw eight bars of the same height and call it a shape.
  const height = (percent: number) =>
    top - floor < 1 ? 78 : 18 + 82 * ((percent - floor) / (top - floor))

  return (
    <div className="block-strip" role="group" aria-label="Weeks in this block">
      {shape.map((week) => (
        <button
          key={week.index}
          type="button"
          className="block-week pressable"
          aria-pressed={week.index === selected}
          data-live={week.index === live}
          aria-label={`Week ${week.index}, ${week.label} — ${week.done} of ${week.total} sessions done`}
          onClick={() => onSelect(week.index)}
        >
          <span className="block-track" aria-hidden="true">
            <span className="block-bar" data-rpe={week.rpe ?? ''} style={{ height: `${height(week.percent)}%` }}>
              {week.done > 0 && (
                <span className="block-bar-done" style={{ height: `${(week.done / week.total) * 100}%` }} />
              )}
            </span>
          </span>
          <span className="block-num data" aria-hidden="true">{week.index}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------- row detail ------------------------------ */

/**
 * What a finished session cost, with the effort it was reported at in ink.
 *
 * No "3 days ago": the badge at the head of the row already carries the date,
 * and on a 320pt screen that phrase is what pushed the RPE off the end.
 */
function LoggedLine({ log }: { log: WorkoutLog }) {
  return (
    <>
      <span className="data">
        {log.durationSec ? `${formatMinutes(log.durationSec)} · ` : ''}
        {logSetCount(log)} sets
      </span>
      {log.sessionRpe != null && (
        <span className="rpe-ink" data-rpe={log.sessionRpe} style={{ marginLeft: 6 }}>
          RPE {num(log.sessionRpe, 1)}
        </span>
      )}
    </>
  )
}

/** What an upcoming session asks for: its heaviest set, which is the number a
    client is actually deciding about on the way to the gym. */
function PlannedLine({ session, profile }: { session: SessionTemplate; profile: Profile }) {
  const main = session.blocks[0]
  const top = topPrescribedSet(main, profile)
  const exercise = main ? getExercise(main.exerciseId) : undefined
  if (!top) return <>{pluralize(session.blocks.length, 'exercise')}</>
  const name = exercise?.shortName ?? exercise?.name
  return (
    <>
      {name && <>{name} · </>}
      <span className="data">
        {top.targetWeight != null
          ? <>{num(top.targetWeight, 1)}<span className="plan-unit"> {profile.units} ×</span> {top.repsLabel}</>
          /* Load first either way. Reps-then-load read as "5 sets of 78.6%" and
             put the two halves of the same prescription in opposite orders on
             the same screen depending on whether a max happened to exist. */
          : <>{top.loadLabel}<span className="plan-unit"> ×</span> {top.repsLabel}</>}
      </span>
      {top.rpe != null && (
        <span className="rpe-ink" data-rpe={top.rpe} style={{ marginLeft: 6 }}>@{num(top.rpe, 1)}</span>
      )}
    </>
  )
}
