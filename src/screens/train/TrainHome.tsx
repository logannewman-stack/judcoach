import { Fragment, useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, CoachNote } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import { flushSection } from './parts'
import { useStore } from '../../store/useStore'
import {
  currentWeekIndex, getWeek, useProgram, weekSchedule, sessionsThisWeek,
} from '../../store/selectors'
import { EXERCISES, getExercise } from '../../data/exercises'
import { resolveSet } from '../../domain/strength'
import { formatShortDate, relativeDay, todayISO, weekdayShortFromDow } from '../../lib/date'
import { num, pluralize } from '../../lib/format'
import { navPresent, useNav } from '../../nav/nav'

export function TrainHome() {
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const push = useNav((s) => s.push)

  const liveWeek = currentWeekIndex(program, today)
  const [weekIndex, setWeekIndex] = useState(liveWeek)
  const week = getWeek(program, weekIndex)
  const schedule = useMemo(() => weekSchedule(program, weekIndex, logs), [program, weekIndex, logs])
  const progress = sessionsThisWeek(program, logs, today)

  return (
    <Screen
      title="Train"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim truncate">{program.name} · {program.weeks.length} weeks</div>
        </div>
      }
      right={{ icon: 'calendar', onPress: () => push('history'), ariaLabel: 'Workout history' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ---------------------------- week picker --------------------------- */}
        <div>
          <div className="hscroll" style={{ gap: 8, paddingBottom: 2 }}>
            {program.weeks.map((w) => {
              const selected = w.index === weekIndex
              const done = weekSchedule(program, w.index, logs).filter((s) => s.log).length
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWeekIndex(w.index)}
                  style={{
                    flex: '0 0 auto',
                    minWidth: 64,
                    padding: '8px 10px 7px',
                    borderRadius: 12,
                    background: selected ? 'var(--accent)' : 'var(--grouped-2)',
                    color: selected ? '#fff' : 'var(--label)',
                    border: w.index === liveWeek && !selected ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                    textAlign: 'center',
                  }}
                >
                  <div className="t-caption2 semibold" style={{ opacity: 0.7 }}>
                    {w.deload ? 'DELOAD' : `WEEK`}
                  </div>
                  <div className="t-headline mono-nums">{w.index}</div>
                  <div className="t-caption2" style={{ opacity: 0.7 }}>{done}/{w.sessions.length}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ----------------------------- week header -------------------------- */}
        {week && (
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 className="t-title2">{week.label.split(' — ')[1]}</h2>
                {week.deload && <Pill tone="tinted">Deload</Pill>}
                {weekIndex === liveWeek && <Pill tone="good">Current</Pill>}
              </div>
              <div className="t-footnote dim" style={{ marginTop: 2 }}>
                Week {week.index} of {program.weeks.length}
                {weekIndex === liveWeek && ` · ${progress.done} of ${progress.total} done`}
              </div>
            </div>
            <CoachNote>{week.emphasis}</CoachNote>
          </div>
        )}

        {/* ------------------------------ sessions ---------------------------- */}
        <ListSection header="Sessions" style={flushSection}>
          {schedule.map(({ session, date, log }) => {
            const main = session.blocks[0]
            const exercise = main ? getExercise(main.exerciseId) : undefined
            const firstSet = main?.sets[0]
            const resolved = firstSet
              ? resolveSet(firstSet, {
                  trainingMax: profile.trainingMaxes[main!.exerciseId],
                  profile,
                })
              : undefined
            const isToday = date === today
            const isPast = date < today

            const opener = exercise && resolved
              ? `${exercise.shortName ?? exercise.name} · ${
                  resolved.targetWeight
                    ? `${num(resolved.targetWeight, 1)} ${profile.units} opener`
                    : resolved.loadLabel
                }`
              : undefined
            const detail = log
              ? [
                  `Completed ${relativeDay(log.date, today)}`,
                  log.durationSec ? `${Math.round(log.durationSec / 60)} min` : null,
                  log.sessionRpe ? `RPE ${log.sessionRpe}` : null,
                ].filter(Boolean).join(' · ')
              : opener ?? pluralize(session.blocks.length, 'exercise')

            return (
              <Fragment key={session.id}>
                <Row
                  leading={
                    <span
                      aria-hidden="true"
                      style={{
                        width: 29,
                        flex: 'none',
                        textAlign: 'center',
                        color: log ? 'var(--green)' : isToday ? 'var(--accent)' : 'var(--label-2)',
                      }}
                    >
                      <span
                        className="t-caption2 semibold"
                        style={{ display: 'block', textTransform: 'uppercase' }}
                      >
                        {weekdayShortFromDow(session.weekday)}
                      </span>
                      <span
                        className="mono-nums"
                        style={{ display: 'block', fontSize: 17, fontWeight: 700, lineHeight: '20px' }}
                      >
                        {formatShortDate(date).split(' ')[1]}
                      </span>
                    </span>
                  }
                  title={session.name}
                  subtitle={
                    <>
                      <span className="truncate" style={{ display: 'block' }}>{session.focus}</span>
                      <span className="truncate dim3 mono-nums" style={{ display: 'block' }}>
                        {detail}
                      </span>
                    </>
                  }
                  trailing={
                    log ? (
                      <Icon name="check.circle.fill" size={17} color="var(--green)" />
                    ) : isToday ? (
                      <Pill tone="tinted">Today</Pill>
                    ) : isPast ? (
                      <Icon name="clock" size={15} color="var(--orange)" weight={2.2} />
                    ) : undefined
                  }
                  chevron
                  onPress={() => push('session', { weekIndex, sessionId: session.id })}
                />
                {/* The primary action is the session's sibling, not a button
                    inside one — a tinted action row, the way iOS stacks it. */}
                {isToday && !log && (
                  <Row
                    title="Start workout"
                    icon="play.fill"
                    iconColor="var(--accent)"
                    tinted
                    onPress={() => navPresent('runner', { weekIndex, sessionId: session.id })}
                  />
                )}
              </Fragment>
            )
          })}
        </ListSection>

        {/* ------------------------------- toolbox ---------------------------- */}
        <ListSection header="Reference" style={flushSection}>
          <Row
            title="Exercise library"
            subtitle={pluralize(EXERCISES.length, 'movement')}
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
            value={String(logs.length)}
            icon="calendar"
            iconColor="var(--green)"
            chevron
            onPress={() => push('history')}
          />
          <Row
            title="Working maxes"
            subtitle="Drives every percentage in the block"
            icon="chart.bar"
            iconColor="var(--blue)"
            chevron
            onPress={() => push('trainingMaxes')}
          />
        </ListSection>

        <div className="gutter">
          <Card>
            <div className="t-footnote dim" style={{ lineHeight: '18px' }}>
              <span className="semibold" style={{ color: 'var(--label)' }}>Goal: </span>
              {program.goal}
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  )
}
