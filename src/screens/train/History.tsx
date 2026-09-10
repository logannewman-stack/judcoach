import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, SectionHeader, StatTile } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented } from '../../components/ios/Controls'
import { BarChart } from '../../components/Charts'
import { LoggedSetChip, flushSection } from './parts'
import { useStore } from '../../store/useStore'
import {
  logSetCount, logTonnage, personalRecords, useProgram, volumeByMuscle,
} from '../../store/selectors'
import { MAIN_LIFTS, MUSCLE_LABELS, exerciseName, getExercise } from '../../data/exercises'
import { bestE1RM, formatRpe } from '../../domain/strength'
import { addDays, formatMediumDate, formatMinutes, relativeDay, startOfWeek, todayISO } from '../../lib/date'
import { compact, estimate, num } from '../../lib/format'
import { useNav } from '../../nav/nav'
import { CoachNotes } from '../../components/CoachNotes'
import { COACH } from '../../data/seed'

/* -------------------------------- history -------------------------------- */

export function History() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const [tab, setTab] = useState<'sessions' | 'volume'>('sessions')
  const today = todayISO()

  const sorted = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)), [logs])

  const weeklyVolume = useMemo(() => {
    const weekStart = startOfWeek(today, 1)
    return volumeByMuscle(logs, weekStart, today)
  }, [logs, today])

  const lastFourWeeks = useMemo(() => {
    const weeks: { label: string; sets: number; tonnage: number }[] = []
    for (let i = 3; i >= 0; i--) {
      const start = addDays(startOfWeek(today, 1), -i * 7)
      const end = addDays(start, 6)
      const inWeek = logs.filter((l) => l.date >= start && l.date <= end)
      weeks.push({
        label: i === 0 ? 'This' : `−${i}`,
        sets: inWeek.reduce((n, l) => n + logSetCount(l), 0),
        tonnage: inWeek.reduce((n, l) => n + logTonnage(l), 0),
      })
    }
    return weeks
  }, [logs, today])

  const totals = useMemo(
    () => ({
      sessions: logs.length,
      sets: logs.reduce((n, l) => n + logSetCount(l), 0),
      tonnage: logs.reduce((n, l) => n + logTonnage(l), 0),
    }),
    [logs],
  )

  return (
    <Screen
      title="History"
      back={{ onPress: pop }}
      titleAccessory={
        <>
          <div
            className="gutter"
            style={{ marginTop: -2, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
          >
            <StatTile label="Sessions" value={totals.sessions} icon="dumbbell" />
            <StatTile label="Working sets" value={totals.sets} icon="list" />
            <StatTile label={`Volume (${profile.units})`} value={compact(totals.tonnage)} icon="chart.bar" />
          </div>
          {/* The filter belongs to what's below it, so it sits closer to the
              content than the groups sit to each other. */}
          <div className="gutter" style={{ marginBottom: 20 }}>
            <Segmented
              options={[
                { value: 'sessions', label: 'Sessions' },
                { value: 'volume', label: 'Volume' },
              ]}
              value={tab}
              onChange={(v) => setTab(v as 'sessions' | 'volume')}
            />
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {tab === 'sessions' ? (
          sorted.length === 0 ? (
            <EmptyState icon="calendar" title="No workouts logged" message="Finish a session and it lands here." />
          ) : (
            <ListSection>
              {sorted.map((log) => {
                const main = log.exercises[0]
                return (
                  <Row
                    key={log.id}
                    title={log.sessionName}
                    subtitle={`${relativeDay(log.date, today)} · ${logSetCount(log)} sets${
                      log.durationSec ? ` · ${formatMinutes(log.durationSec)}` : ''
                    }${main ? ` · ${exerciseName(main.exerciseId)}` : ''}`}
                    value={
                      log.sessionRpe != null ? (
                        <Pill tone={log.sessionRpe >= 9 ? 'warn' : 'default'}>{formatRpe(log.sessionRpe)}</Pill>
                      ) : undefined
                    }
                    chevron
                    onPress={() => push('logDetail', { logId: log.id })}
                  />
                )
              })}
            </ListSection>
          )
        ) : (
          <>
            <ListSection
              header="Hard sets this week"
              footer="Dashed line marks ten hard sets — the weekly floor Jud aims for on each muscle group. Secondary involvement counts as half a set."
              style={flushSection}
            >
              <div style={{ padding: 16 }}>
                <BarChart
                  bars={Object.entries(weeklyVolume)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([muscle, sets]) => ({
                      label: (MUSCLE_LABELS[muscle] ?? muscle).slice(0, 5),
                      value: Math.round(sets),
                      target: 10,
                    }))}
                  height={170}
                />
              </div>
            </ListSection>

            <ListSection
              header="Last four weeks"
              footer="Working sets per week. A deload should visibly dip — if it doesn't, you didn't deload."
            >
              <div style={{ padding: 16 }}>
                <BarChart
                  bars={lastFourWeeks.map((w) => ({ label: w.label, value: w.sets }))}
                  height={150}
                  formatValue={(v) => String(v)}
                />
              </div>
            </ListSection>
          </>
        )}
      </div>
    </Screen>
  )
}

/* ------------------------------- log detail ------------------------------ */

export function LogDetail({ logId, focus }: { logId: string; focus?: string }) {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const program = useProgram()
  const log = logs.find((l) => l.id === logId)

  if (!log) {
    return (
      <Screen title="Workout" back={{ onPress: pop }}>
        <div className="gutter t-body dim">That workout is no longer stored.</div>
      </Screen>
    )
  }

  const week = program.weeks.find((w) => w.index === log.weekIndex)

  return (
    <Screen
      title={log.sessionName}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim">{formatMediumDate(log.date)}</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            {week && <Pill tone="tinted">{week.label.split(' — ')[0]}</Pill>}
            {log.durationSec != null && <Pill icon="clock">{formatMinutes(log.durationSec)}</Pill>}
            <Pill icon="list">{logSetCount(log)} sets</Pill>
            {log.sessionRpe != null && (
              <Pill tone={log.sessionRpe >= 9 ? 'warn' : 'default'}>{formatRpe(log.sessionRpe)}</Pill>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="gutter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatTile label={`Volume (${profile.units})`} value={compact(logTonnage(log))} icon="chart.bar" />
          <StatTile label="Exercises" value={log.exercises.length} icon="dumbbell" />
          <StatTile
            label="Top e1RM"
            value={estimate(Math.max(...log.exercises.map((e) => bestE1RM(e.sets)), 0))}
            icon="bolt.fill"
          />
        </div>

        {log.notes && (
          <div className="gutter">
            <Card style={{ margin: 0, width: '100%' }}>
              <div className="t-caption1 dim semibold" style={{ marginBottom: 4 }}>YOUR NOTE</div>
              <div className="t-subhead" style={{ lineHeight: '21px' }}>{log.notes}</div>
            </Card>
          </div>
        )}

        <div>
          <SectionHeader title="Every set" />
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {log.exercises.map((entry, i) => {
              const exercise = getExercise(entry.exerciseId)
              return (
                <button
                  key={`${entry.exerciseId}-${i}`}
                  type="button"
                  className="card"
                  style={{ margin: 0, padding: 13, width: '100%', textAlign: 'left' }}
                  onClick={() => push('exerciseDetail', { exerciseId: entry.exerciseId })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="t-headline truncate" style={{ flex: 1, minWidth: 0 }}>
                      {exercise?.name ?? entry.exerciseId}
                    </span>
                    <span className="t-caption1 dim mono-nums">
                      e1RM {estimate(bestE1RM(entry.sets))}
                    </span>
                    <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {entry.sets.map((s) => (
                      <LoggedSetChip key={s.id} set={s} units={profile.units} />
                    ))}
                  </div>
                  {entry.note && (
                    <div className="t-caption1 dim" style={{ marginTop: 7 }}>{entry.note}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Jud's read of this session, next to the sets it is about. */}
        <div>
          <SectionHeader title={`From ${COACH.name}`} />
          <div className="gutter">
            <CoachNotes
              spotlight={focus === 'notes'}
              anchor={{ kind: 'workout', id: log.id }}
              empty={`${COACH.name} hasn't looked at this one yet.`}
            />
          </div>
        </div>
      </div>
    </Screen>
  )
}

/* ---------------------------- personal records --------------------------- */

export function PersonalRecordsScreen() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const records = useMemo(() => personalRecords(logs), [logs])

  // Ranking a calf raise against a deadlift by absolute load is meaningless, so
  // the main lifts get their own section and nothing carries a rank number.
  const mainIds = new Set(MAIN_LIFTS.map((l) => l.id))
  const mainRecords = records.filter((r) => mainIds.has(r.exerciseId))
  const otherRecords = records.filter((r) => !mainIds.has(r.exerciseId))

  return (
    <Screen
      title="Records"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim" style={{ lineHeight: '21px' }}>
            Best estimated one-rep max for every movement you've logged, worked back from the load, reps
            and RPE of your best set.
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {records.length === 0 ? (
          <EmptyState icon="seal.fill" title="No records yet" message="Log a workout and they start stacking up." />
        ) : (
          <>
            {mainRecords.length > 0 && (
              <ListSection
                header="Main lifts"
                footer="Estimated maxes come from the RPE chart, not a tested single."
                style={flushSection}
              >
                {mainRecords.map((pr) => (
                  <RecordRow
                    key={pr.exerciseId}
                    pr={pr}
                    units={profile.units}
                    highlight
                    onPress={() => push('exerciseDetail', { exerciseId: pr.exerciseId })}
                  />
                ))}
              </ListSection>
            )}
            {otherRecords.length > 0 && (
              <ListSection header="Everything else">
                {otherRecords.map((pr) => (
                  <RecordRow
                    key={pr.exerciseId}
                    pr={pr}
                    units={profile.units}
                    onPress={() => push('exerciseDetail', { exerciseId: pr.exerciseId })}
                  />
                ))}
              </ListSection>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}

function RecordRow({
  pr, units, highlight, onPress,
}: {
  pr: ReturnType<typeof personalRecords>[number]
  units: string
  highlight?: boolean
  onPress: () => void
}) {
  return (
    <Row
      title={exerciseName(pr.exerciseId)}
      subtitle={`${num(pr.weight, 1)} × ${pr.reps}${pr.rpe ? ` @ RPE ${num(pr.rpe, 1)}` : ''} · ${relativeDay(pr.date)}`}
      value={`${num(pr.e1rm, 0)} ${units}`}
      leading={
        <span
          style={{
            width: 26, height: 26, borderRadius: 8, flex: 'none',
            display: 'grid', placeItems: 'center',
            background: highlight ? 'rgba(255,149,0,0.18)' : 'var(--fill-3)',
          }}
        >
          <Icon
            name={highlight ? 'seal.fill' : 'dumbbell'}
            size={14}
            weight={2.2}
            color={highlight ? 'var(--orange)' : 'var(--label-2)'}
          />
        </span>
      }
      chevron
      onPress={onPress}
      inset
    />
  )
}
