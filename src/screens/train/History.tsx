import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Segmented } from '../../components/ios/Controls'
import { BarChart } from '../../components/Charts'
import { flushSection } from './parts'
import { useStore } from '../../store/useStore'
import {
  logSetCount, logTonnage, personalRecords, useProgram, volumeByMuscle,
} from '../../store/selectors'
import type { PersonalRecord } from '../../store/selectors'
import {
  MAIN_LIFTS, MUSCLE_LABELS, exerciseName, exerciseShortName, getExercise,
} from '../../data/exercises'
import type { LoggedSet, WorkoutLog } from '../../domain/types'
import { bestE1RM, snapRpe, topSet } from '../../domain/strength'
import {
  addDays, formatMediumDate, formatMinutes, formatShortDate, fromISODate,
  relativeDay, startOfWeek, todayISO,
} from '../../lib/date'
import { compact, estimate, num } from '../../lib/format'
import { useNav } from '../../nav/nav'
import { CoachNotes } from '../../components/CoachNotes'
import { COACH } from '../../data/seed'
import '../../styles/log.css'

/* ============================ shared log parts ============================
   The set table lives here rather than in parts.tsx because it belongs to the
   record rather than to the runner: History writes a session's page with it
   and Library writes a movement's, and those are the same table.
   ======================================================================== */

/** A session's effort, stamped in the colour the scale gives it. */
export function RpeStamp({ rpe }: { rpe: number }) {
  return <span className="rpe-stamp" data-rpe={snapRpe(rpe)}>{num(rpe, 1)}</span>
}

/** A rule of figures under a screen title. */
function Ledger({ children }: { children: ReactNode }) {
  return <div className="ledger">{children}</div>
}

function LedgerCell({
  label, value, unit, rpe,
}: {
  label: string
  value: ReactNode
  unit?: string
  /** Colours the figure on the intensity ramp, for a cell that holds effort. */
  rpe?: number
}) {
  return (
    <div className="ledger-cell" data-rpe={rpe != null ? snapRpe(rpe) : undefined}>
      <span className="eyebrow">{label}</span>
      <span
        className="figure ledger-figure"
        style={rpe != null ? { color: 'var(--rpe)' } : undefined}
      >
        {value}
        {unit && <span className="ledger-unit"> {unit}</span>}
      </span>
    </div>
  )
}

/** Names the four columns, once at the top of a page of them. */
export function SetTableHead() {
  return (
    <div className="set-table set-head">
      <span className="eyebrow">Set</span>
      <span className="eyebrow">Load</span>
      <span className="eyebrow">Reps</span>
      <span className="eyebrow">RPE</span>
    </div>
  )
}

function SetCells({ set, units }: { set: LoggedSet; units: string }) {
  return (
    <>
      <span className="set-cell">
        {/* A bodyweight lift logs a load of zero, and a column of "0 lb" reads
            as a fault rather than as a pull-up. */}
        {set.weight > 0 ? (
          <>{num(set.weight, 1)}<span className="unit"> {units}</span></>
        ) : (
          <span className="unit">BW</span>
        )}
      </span>
      <span className="set-cell set-times">×</span>
      <span className="set-cell">{set.reps}</span>
      {set.rpe != null ? (
        <span className="set-rpe" data-rpe={snapRpe(set.rpe)}>{num(set.rpe, 1)}</span>
      ) : (
        // An effort nobody recorded gets a blank cell, the way a log book
        // leaves one: a dash would have to be legible, and a legible dash in
        // the hottest column of the page says something that isn't true.
        <span />
      )}
    </>
  )
}

/**
 * One movement's work, ruled into columns. `previous` adds the same
 * movement's best set from the session before, on the same verticals, which is
 * the comparison a lifter opens an old workout to make.
 */
export function SetTable({
  sets, units, previous,
}: {
  sets: LoggedSet[]
  units: string
  previous?: { date: string; sets: LoggedSet[] }
}) {
  const prevBest = previous && topSet(previous.sets)
  return (
    <div className="set-table">
      {sets.map((set, i) => (
        <div key={set.id} style={{ display: 'contents' }}>
          <span className="set-index">{i + 1}</span>
          <SetCells set={set} units={units} />
        </div>
      ))}
      {prevBest && (
        <>
          <span className="set-prev-rule" />
          <span className="set-index set-prev">{formatShortDate(previous!.date)}</span>
          <span className="set-prev" style={{ display: 'contents' }}>
            <SetCells set={prevBest} units={units} />
          </span>
        </>
      )}
    </div>
  )
}

/* -------------------------------- history -------------------------------- */

/** Sessions grouped into the months they were trained in, newest first. */
function byMonth(logs: WorkoutLog[], today: string): { key: string; label: string; logs: WorkoutLog[] }[] {
  const thisYear = today.slice(0, 4)
  const out: { key: string; label: string; logs: WorkoutLog[] }[] = []
  for (const log of logs) {
    const key = log.date.slice(0, 7)
    let group = out[out.length - 1]
    if (!group || group.key !== key) {
      const d = fromISODate(log.date)
      const month = d.toLocaleDateString('en-US', { month: 'long' })
      group = { key, label: key.slice(0, 4) === thisYear ? month : `${month} ${key.slice(0, 4)}`, logs: [] }
      out.push(group)
    }
    group.logs.push(log)
  }
  return out
}

export function History() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const [tab, setTab] = useState<'sessions' | 'volume'>('sessions')
  const today = todayISO()

  const sorted = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)), [logs])
  const months = useMemo(() => byMonth(sorted, today), [sorted, today])

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

  const totals = useMemo(() => {
    const rated = logs.filter((l) => l.sessionRpe != null)
    return {
      sessions: logs.length,
      sets: logs.reduce((n, l) => n + logSetCount(l), 0),
      tonnage: logs.reduce((n, l) => n + logTonnage(l), 0),
      // How hard the block has actually been run, which is the one number on
      // this screen that says something the totals can't.
      rpe: rated.length
        ? rated.reduce((n, l) => n + (l.sessionRpe ?? 0), 0) / rated.length
        : undefined,
    }
  }, [logs])

  return (
    <Screen
      title="History"
      back={{ onPress: pop }}
      titleAccessory={
        <>
          {logs.length > 0 && (
            <div style={{ marginTop: -2, marginBottom: 16 }}>
              <Ledger>
                <LedgerCell label="Sessions" value={totals.sessions} />
                <LedgerCell label="Sets" value={totals.sets} />
                <LedgerCell label={`Volume (${profile.units})`} value={compact(totals.tonnage)} />
                {totals.rpe != null && (
                  <LedgerCell label="Avg RPE" value={num(totals.rpe, 1)} rpe={totals.rpe} />
                )}
              </Ledger>
            </div>
          )}
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
            months.map((month) => (
              <ListSection key={month.key} header={month.label} style={flushSection}>
                {month.logs.map((log) => {
                  const when = relativeDay(log.date, today)
                  const sets = logSetCount(log)
                  return (
                    <Row
                      key={log.id}
                      title={log.sessionName}
                      subtitle={
                        <span className="log-meta">
                          {when}
                          <span className="log-meta-sep"> · </span>
                          {sets} sets
                          {log.durationSec != null && (
                            <>
                              <span className="log-meta-sep"> · </span>
                              {formatMinutes(log.durationSec)}
                            </>
                          )}
                          <span className="log-meta-sep"> · </span>
                          {compact(logTonnage(log))} {profile.units}
                        </span>
                      }
                      value={log.sessionRpe != null ? <RpeStamp rpe={log.sessionRpe} /> : undefined}
                      // The stamp is a bare numeral by design, so the row says
                      // out loud what the colour says by eye.
                      ariaLabel={`${log.sessionName}, ${when}, ${sets} sets${
                        log.sessionRpe != null ? `, RPE ${num(log.sessionRpe, 1)}` : ''
                      }`}
                      chevron
                      onPress={() => push('logDetail', { logId: log.id })}
                    />
                  )
                })}
              </ListSection>
            ))
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

  /**
   * The session before this one for each movement in it. "What changed since"
   * is the question an old workout gets opened to answer, and it cannot be
   * answered by the session alone.
   */
  const previous = useMemo(() => {
    const out = new Map<string, { date: string; sets: LoggedSet[] }>()
    if (!log) return out
    const earlier = logs
      .filter((l) => l.date < log.date)
      .sort((a, b) => b.date.localeCompare(a.date))
    for (const entry of log.exercises) {
      if (out.has(entry.exerciseId)) continue
      for (const past of earlier) {
        const was = past.exercises.find((e) => e.exerciseId === entry.exerciseId && e.sets.length > 0)
        if (was) {
          out.set(entry.exerciseId, { date: past.date, sets: was.sets })
          break
        }
      }
    }
    return out
  }, [logs, log])

  if (!log) {
    return (
      <Screen title="Workout" back={{ onPress: pop }}>
        <div className="gutter t-body dim">That workout is no longer stored.</div>
      </Screen>
    )
  }

  const week = program.weeks.find((w) => w.index === log.weekIndex)
  const topEstimate = Math.max(...log.exercises.map((e) => bestE1RM(e.sets)), 0)

  return (
    <Screen
      title={log.sessionName}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim truncate">
            {formatMediumDate(log.date)}
            {week && ` · ${week.label.split(' — ')[0]}`}
            {log.durationSec != null && ` · ${formatMinutes(log.durationSec)}`}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* The verdict first, then the numbers that produced it. */}
        <Ledger>
          {log.sessionRpe != null && (
            <LedgerCell label="RPE" value={num(log.sessionRpe, 1)} rpe={log.sessionRpe} />
          )}
          <LedgerCell label="Sets" value={logSetCount(log)} />
          <LedgerCell label={`Volume (${profile.units})`} value={compact(logTonnage(log))} />
          <LedgerCell label="Top e1RM" value={estimate(topEstimate)} />
        </Ledger>

        {log.notes && (
          <div className="gutter">
            <Card style={{ margin: 0, width: '100%' }}>
              <div className="eyebrow" style={{ marginBottom: 5 }}>Your note</div>
              <div className="t-subhead" style={{ lineHeight: '21px' }}>{log.notes}</div>
            </Card>
          </div>
        )}

        <div>
          <SectionHeader title="Every set" />
          {/* One ruled page rather than a card per movement: the load column
              runs unbroken from the first set of the session to the last, so
              the whole workout can be read down a single vertical. */}
          <div className="card" style={{ padding: '12px 14px 3px' }}>
            <SetTableHead />
            {log.exercises.map((entry, i) => {
              const exercise = getExercise(entry.exerciseId)
              const est = bestE1RM(entry.sets)
              const was = previous.get(entry.exerciseId)
              return (
                <div className="log-block" key={`${entry.exerciseId}-${i}`}>
                  <button
                    type="button"
                    className="log-block-head"
                    onClick={() => push('exerciseDetail', { exerciseId: entry.exerciseId })}
                  >
                    <span className="log-block-n">{i + 1}</span>
                    <span className="t-headline truncate" style={{ flex: 1, minWidth: 0 }}>
                      {exercise?.name ?? entry.exerciseId}
                    </span>
                    {est > 0 && (
                      <span className="log-block-est">
                        <span className="eyebrow">e1RM</span> {num(est, 0)}
                      </span>
                    )}
                    <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />
                  </button>
                  <SetTable sets={entry.sets} units={profile.units} previous={was} />
                  {entry.note && <div className="log-note">{entry.note}</div>}
                </div>
              )
            })}
          </div>
          <div className="list-footer">
            A dated line under a movement is the best set you hit last time.
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
  const today = todayISO()

  const byId = useMemo(() => new Map(records.map((r) => [r.exerciseId, r])), [records])
  const mainIds = useMemo(() => new Set(MAIN_LIFTS.map((l) => l.id)), [])

  // Ranking a calf raise against a deadlift by absolute load is meaningless, so
  // the board holds only the four lifts the block is written around, and
  // nothing below it carries a rank number.
  const estimated = records.filter((r) => r.hasEstimate && !mainIds.has(r.exerciseId))
  // A twelve-rep back-off set says nothing about a max, so these keep the one
  // honest number they have: the most weight actually handled.
  const heaviest = records.filter((r) => !r.hasEstimate)

  // Powerlifting's total, and the only sum on this screen that means anything.
  const totalLifts = ['back-squat', 'bench-press', 'deadlift']
  const total = totalLifts.every((id) => byId.get(id)?.hasEstimate)
    ? totalLifts.reduce((n, id) => n + Math.round(byId.get(id)!.e1rm), 0)
    : 0

  // A record is a moment before it is a row in a table, and the newest one is
  // the only thing on this screen that has changed since the client last
  // looked at it. So it leads, in a line rather than in a box of its own.
  const latest = records.reduce<PersonalRecord | undefined>(
    (best, r) => (!best || r.date > best.date ? r : best),
    undefined,
  )

  return (
    <Screen
      title="Records"
      back={{ onPress: pop }}
      titleAccessory={
        latest ? (
          <div className="gutter" style={{ marginTop: -6, marginBottom: 18 }}>
            <div className="t-subhead dim" style={{ lineHeight: '21px' }}>
              Your last record: {exerciseName(latest.exerciseId)},{' '}
              <span className="data" style={{ color: 'var(--label)' }}>
                {num(latest.hasEstimate ? latest.e1rm : latest.topWeight, 0)} {profile.units}
              </span>
              , {relativeDay(latest.date, today).toLowerCase()}.
            </div>
          </div>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <SectionHeader title="Main lifts" />
          <div className="board">
            {MAIN_LIFTS.map((lift) => (
              <BoardCell
                key={lift.id}
                name={exerciseShortName(lift.id)}
                pr={byId.get(lift.id)}
                units={profile.units}
                onPress={() => push('exerciseDetail', { exerciseId: lift.id })}
              />
            ))}
            {total > 0 && (
              <div className="board-total">
                <span className="eyebrow">Squat + bench + deadlift</span>
                <span className="figure board-total-figure">
                  {num(total, 0)}
                  <span className="ledger-unit"> {profile.units}</span>
                </span>
              </div>
            )}
          </div>
          <div className="list-footer">
            {records.length === 0
              ? 'A heavy set on any of these writes its number, worked back from the load, reps and RPE you log.'
              : 'Estimated maxes come from the RPE chart, not a tested single.'}
          </div>
        </div>

        {estimated.length > 0 && (
          <ListSection header="Estimated maxes" style={flushSection}>
            {estimated.map((pr) => (
              <RecordRow
                key={pr.exerciseId}
                pr={pr}
                units={profile.units}
                onPress={() => push('exerciseDetail', { exerciseId: pr.exerciseId })}
              />
            ))}
          </ListSection>
        )}

        {heaviest.length > 0 && (
          <ListSection
            header="Heaviest lifted"
            footer="Nothing here was taken near enough to a max to estimate one, so these are the loads themselves."
          >
            {heaviest.map((pr) => (
              <RecordRow
                key={pr.exerciseId}
                pr={pr}
                units={profile.units}
                onPress={() => push('exerciseDetail', { exerciseId: pr.exerciseId })}
              />
            ))}
          </ListSection>
        )}
      </div>
    </Screen>
  )
}

/** The set a record was worked back from: load, reps and the effort it cost. */
function RecordSource({ pr, load = true }: { pr: PersonalRecord; load?: boolean }) {
  return (
    <>
      {load && (
        <>
          {num(pr.weight, 1)}
          <span className="log-meta-sep"> × </span>
        </>
      )}
      {pr.reps}{!load && ' reps'}
      {pr.rpe != null && (
        <>
          {' '}
          <span className="at" data-rpe={snapRpe(pr.rpe)}>@{num(pr.rpe, 1)}</span>
        </>
      )}
      <span className="log-meta-sep"> · </span>
      {formatShortDate(pr.date)}
    </>
  )
}

function BoardCell({
  name, pr, units, onPress,
}: {
  name: string
  pr?: PersonalRecord
  units: string
  onPress: () => void
}) {
  if (!pr) {
    return (
      <div className="board-cell">
        <span className="eyebrow">{name}</span>
        <span className="figure board-figure empty">—</span>
        <span className="board-source">Not logged yet</span>
      </div>
    )
  }
  const value = pr.hasEstimate ? pr.e1rm : pr.topWeight
  return (
    <button
      type="button"
      className="board-cell pressable"
      onClick={onPress}
      aria-label={`${name}, ${num(value, 0)} ${units}, from ${num(pr.weight, 1)} by ${pr.reps} reps`}
    >
      <span className="eyebrow">{name}</span>
      <span className="figure board-figure">
        {num(value, 0)}
        <span className="ledger-unit"> {units}</span>
      </span>
      <span className="board-source"><RecordSource pr={pr} /></span>
    </button>
  )
}

function RecordRow({
  pr, units, onPress,
}: {
  pr: PersonalRecord
  units: string
  onPress: () => void
}) {
  // An unestimated record showed "0 lb" here, because that is literally what
  // the selector stores when no set qualifies. The honest number is the load.
  const value = pr.hasEstimate ? pr.e1rm : pr.topWeight
  return (
    <Row
      title={exerciseName(pr.exerciseId)}
      subtitle={<span className="log-meta"><RecordSource pr={pr} load={pr.hasEstimate} /></span>}
      value={
        <span className="data" style={{ color: 'var(--label)' }}>
          {num(value, 0)}
          <span className="ledger-unit"> {units}</span>
        </span>
      }
      chevron
      onPress={onPress}
    />
  )
}
