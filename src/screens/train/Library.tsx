import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented } from '../../components/ios/Controls'
import { SearchField } from '../../components/ios/SearchField'
import { LineChart } from '../../components/Charts'
import { flushSection } from './parts'
import { SetTable, SetTableHead } from './History'
import { useStore } from '../../store/useStore'
import {
  e1rmSeries, performanceHistory, personalRecords, sessionDate, useProgram,
} from '../../store/selectors'
import { EQUIPMENT_LABELS, EXERCISES, MUSCLE_LABELS, getExercise } from '../../data/exercises'
import type { MuscleGroup } from '../../domain/types'
import { bestE1RM, snapRpe, topSet } from '../../domain/strength'
import { formatDuration, formatShortDate, relativeDay, relativeTime, todayISO } from '../../lib/date'
import { num, pluralize, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'
import '../../styles/log.css'

/* ------------------------------ the library ----------------------------- */

const GROUPS: { key: string; label: string; muscles: MuscleGroup[]; tint: string }[] = [
  { key: 'all', label: 'All', muscles: [], tint: 'var(--gray)' },
  {
    key: 'legs',
    label: 'Legs',
    muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'],
    tint: 'var(--indigo)',
  },
  { key: 'push', label: 'Push', muscles: ['chest', 'shoulders', 'triceps'], tint: 'var(--pink)' },
  {
    key: 'pull',
    label: 'Pull',
    muscles: ['back', 'lats', 'biceps', 'traps', 'forearms'],
    tint: 'var(--teal)',
  },
  { key: 'core', label: 'Core', muscles: ['core'], tint: 'var(--purple)' },
]

/**
 * The colour a movement wears in the list: the one its own filter would find it
 * under, taken from what it trains first.
 *
 * Fifty-five rows of grey text is a page you search rather than browse, and the
 * four families are already named in the control directly above it — so the
 * tile is the legend, and "where are the pulls" is answered without reading a
 * word. A movement in none of the four keeps the neutral tile rather than being
 * filed somewhere it does not belong.
 */
function groupTint(primary: MuscleGroup[]): string {
  const first = primary[0]
  return GROUPS.find((g) => first && g.muscles.includes(first))?.tint ?? 'var(--gray)'
}

export function ExerciseLibrary() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const muscles = GROUPS.find((g) => g.key === group)?.muscles ?? []
    return EXERCISES.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (muscles.length && !e.primary.some((m) => muscles.includes(m))) return false
      return true
    })
  }, [query, group])

  // The heaviest load handled on each movement, in one pass over the logs.
  // Asking per row meant re-scanning the full history fifty-odd times per
  // keystroke, and a normalised sparkline — in which two pounds and fifty look
  // identical — was never a number anyone could read off a browse row.
  const best = useMemo(() => {
    const out = new Map<string, number>()
    for (const pr of personalRecords(logs)) out.set(pr.exerciseId, pr.topWeight)
    return out
  }, [logs])

  return (
    <Screen
      title="Exercises"
      back={{ onPress: pop }}
      titleAccessory={
        // Search and filter are the screen's one control cluster, so they sit
        // with the title rather than floating a section above the results.
        <div
          className="gutter"
          style={{ marginTop: 2, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${EXERCISES.length} movements`}
            label="Search exercises"
          />
          <Segmented
            options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
            value={group}
            onChange={setGroup}
          />
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {results.length === 0 ? (
          <EmptyState
            icon="search"
            title={query.trim() ? `No match for “${query.trim()}”` : 'Nothing in this group'}
            message={
              query.trim()
                ? 'Try a shorter term, or clear the filter above — it is still narrowing the list.'
                : 'Nothing in the library is filed under this group yet.'
            }
          />
        ) : (
          // The trailing figures are a column, so the column is named once at
          // its head rather than carrying a unit on all fifty-five rows — and
          // only when the column has something in it. A client who has not
          // trained yet was being shown a heading over fifty-five blanks.
          <ListSection
            header={pluralize(results.length, 'movement')}
            headerAccessory={
              results.some((e) => (best.get(e.id) ?? 0) > 0)
                ? <span>Heaviest ({profile.units})</span>
                : undefined
            }
            style={flushSection}
          >
            {results.map((exercise) => {
              const heaviest = best.get(exercise.id) ?? 0
              return (
                <Row
                  key={exercise.id}
                  title={exercise.name}
                  subtitle={`${exercise.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
                  icon="dumbbell"
                  iconColor={groupTint(exercise.primary)}
                  trailing={heaviest > 0 ? <span className="lib-best">{num(heaviest, 0)}</span> : undefined}
                  ariaLabel={
                    heaviest > 0
                      ? `${exercise.name}, heaviest ${num(heaviest, 0)} ${profile.units}`
                      : undefined
                  }
                  chevron
                  onPress={() => push('exerciseDetail', { exerciseId: exercise.id })}
                />
              )
            })}
          </ListSection>
        )}
      </div>
    </Screen>
  )
}

/* ----------------------------- exercise detail --------------------------- */

/** "today" / "on Monday" / "on Sep 17", mid-sentence. */
function whenPhrase(date: string): string {
  const { label, lower, kind } = relativeTime(date)
  return kind === 'adverb' ? lower : `on ${label}`
}

/** "Back Squat and Front Squat" — a list a person reads, not a CSV. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

/**
 * Where a movement sits in the block, and what stands in for it.
 *
 * "When will I meet this?" is the only thing a movement nobody has trained can
 * honestly say about itself, and the programme already knows the answer — so a
 * screen with no history on it is not a screen with nothing on it.
 */
function useProgrammeSlot(exerciseId: string) {
  const program = useProgram()
  const today = todayISO()
  return useMemo(() => {
    let next: { date: string; session: string } | undefined
    let appears = 0
    for (const week of program.weeks) {
      for (const session of week.sessions) {
        if (!session.blocks.some((b) => b.exerciseId === exerciseId)) continue
        appears++
        const date = sessionDate(program, week.index, session.weekday)
        if (date >= today && (!next || date < next.date)) next = { date, session: session.name }
      }
    }
    // Reverse the substitution list: a movement reached from "if it's taken or
    // it hurts" is in the app precisely because something else is programmed.
    const standsInFor = EXERCISES.filter((e) => e.substituteIds?.includes(exerciseId))
    return { appears, next, standsInFor }
  }, [program, exerciseId, today])
}

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const exercise = getExercise(exerciseId)

  const history = useMemo(() => performanceHistory(logs, exerciseId), [logs, exerciseId])
  const series = useMemo(() => e1rmSeries(logs, exerciseId), [logs, exerciseId])
  const pr = useMemo(
    () => personalRecords(logs).find((p) => p.exerciseId === exerciseId),
    [logs, exerciseId],
  )
  const slot = useProgrammeSlot(exerciseId)

  if (!exercise) {
    return (
      <Screen title="Exercise" back={{ onPress: pop }}>
        <div className="gutter t-body dim">That movement isn't in the library.</div>
      </Screen>
    )
  }

  const tm = profile.trainingMaxes[exercise.id]

  return (
    <Screen
      title={exercise.name}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: 2, marginBottom: 18, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <Pill tone="tinted">{EQUIPMENT_LABELS[exercise.equipment]}</Pill>
          {exercise.primary.map((m) => (
            <Pill key={m}>{MUSCLE_LABELS[m]}</Pill>
          ))}
          {exercise.isMainLift && <Pill tone="warn" icon="bolt.fill">Main lift</Pill>}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* --------------------------------- PR -----------------------------
            Shown for a working max alone as well: a client who has set their
            maxes but not trained yet still has the one number the runner is
            about to load the bar from. */}
        {(pr || tm) && (
          <div>
            <div className="ledger">
              {pr?.hasEstimate && (
                <div className="ledger-cell">
                  <span className="eyebrow">Est. 1RM</span>
                  <span className="figure ledger-figure">
                    {num(pr.e1rm, 0)}
                    <span className="ledger-unit"> {profile.units}</span>
                  </span>
                </div>
              )}
              {pr && (
                <div className="ledger-cell">
                  <span className="eyebrow">Heaviest</span>
                  <span className="figure ledger-figure">
                    {num(pr.topWeight, 0)}
                    <span className="ledger-unit"> {profile.units}</span>
                  </span>
                </div>
              )}
              {tm && (
                <div className="ledger-cell">
                  <span className="eyebrow">Working max</span>
                  <span className="figure ledger-figure">
                    {num(tm, 0)}
                    <span className="ledger-unit"> {profile.units}</span>
                  </span>
                </div>
              )}
              {/* A rule of figures needs more than one figure. Before a movement
                  has been trained there is exactly one, and the strip ran two
                  thirds empty; the fact that stands in for a record until then
                  is when the programme next calls for it. */}
              {!pr && tm && slot.next && (
                <div className="ledger-cell">
                  <span className="eyebrow">Next due</span>
                  <span className="figure ledger-figure">{formatShortDate(slot.next.date)}</span>
                </div>
              )}
            </div>
            {!pr && tm && slot.next && (
              <div className="list-footer">
                Nothing logged on it yet — the max above is what the bar gets loaded from. Next
                programmed in {slot.next.session}.
              </div>
            )}
            {pr && (
              <div className="list-footer">
                <span className="log-meta" style={{ display: 'inline' }}>
                  From {num(pr.weight, 1)}
                  <span className="log-meta-sep"> × </span>
                  {pr.reps}
                  {pr.rpe != null && (
                    <>
                      {' '}
                      <span className="at" data-rpe={snapRpe(pr.rpe)}>@{num(pr.rpe, 1)}</span>
                    </>
                  )}
                  <span className="log-meta-sep"> · </span>
                  {formatShortDate(pr.date)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------- trend ---------------------------- */}
        {series.length > 2 && (
          <div>
            <SectionHeader title="Estimated max over time" />
            <Card>
              <LineChart
                data={series.map((p) => ({ x: p.date, y: p.value }))}
                height={165}
                showDots
                formatValue={(v) => `${num(v, 0)} ${profile.units}`}
                formatLabel={(x) => formatShortDate(x)}
                ariaLabel={`${exercise.name} estimated one-rep max`}
              />
            </Card>
          </div>
        )}

        {/* -------------------------------- cues ---------------------------- */}
        <div>
          <SectionHeader title="How Jud wants it" />
          <Card>
            {exercise.setup && exercise.setup.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>Set-up</div>
                {exercise.setup.map((s, i) => (
                  <div key={i} className="t-subhead dim" style={{ lineHeight: '20px' }}>{s}</div>
                ))}
              </div>
            )}
            {exercise.cues.map((cue, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--accent)', lineHeight: '20px' }}>•</span>
                <span className="t-subhead" style={{ lineHeight: '20px' }}>{cue}</span>
              </div>
            ))}
            {/* The rest the app actually times, not a range worked out from it:
                rounding the floor up and adding a minute to the ceiling had this
                page asking for three to four minutes on a movement whose timer
                starts at 2:30. */}
            <div className="t-caption1 dim" style={{ marginTop: 10 }}>
              Rest <span className="data">{formatDuration(exercise.defaultRestSec)}</span> between
              working sets — what the timer starts when you log one.
            </div>
          </Card>
        </div>

        {/* ----------------------------- substitutes ------------------------ */}
        {exercise.substituteIds && exercise.substituteIds.length > 0 && (
          <div>
            <SectionHeader title="If it's taken or it hurts" />
            <ListSection style={flushSection}>
              {exercise.substituteIds.map((id) => {
                const sub = getExercise(id)
                if (!sub) return null
                return (
                  <Row
                    key={id}
                    title={sub.name}
                    subtitle={`${sub.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${EQUIPMENT_LABELS[sub.equipment]}`}
                    // The same tile it wears in the library, so a substitute is
                    // recognisably the thing you would have found by browsing.
                    icon="dumbbell"
                    iconColor={groupTint(sub.primary)}
                    chevron
                    onPress={() => push('exerciseDetail', { exerciseId: id })}
                  />
                )
              })}
            </ListSection>
          </div>
        )}

        {/* ------------------------------ history --------------------------- */}
        <div>
          <SectionHeader title="Your history" />
          {history.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Not trained yet"
              message={
                slot.next
                  ? `Next up in ${slot.next.session} ${whenPhrase(slot.next.date)}. Your sets land here as you log them.`
                  : slot.appears > 0
                    ? 'It is in this block but every session holding it is behind you. Log it and the table below writes itself.'
                    : slot.standsInFor.length > 0
                      ? `Not in this block — it is here as a stand-in for ${listNames(slot.standsInFor.map((e) => e.name))}. Swap it in mid-session and it starts keeping its own history.`
                      : 'Nothing logged on it yet. The first set you record starts the table.'
              }
            />
          ) : (
            <>
              {/* The same ruled page a session gets, sliced the other way: one
                  movement down the block, so the load column reads as a
                  training history rather than as a stack of cards. */}
              <div className="card" style={{ padding: '12px 14px 3px' }}>
                <SetTableHead />
                {history.slice(0, 12).map((entry, i) => {
                  const est = bestE1RM(entry.sets)
                  // The session below is the previous one, so the movement
                  // between them is the number worth naming.
                  const before = history[i + 1]
                  const wasEst = before ? bestE1RM(before.sets) : 0
                  const delta = est > 0 && wasEst > 0 ? Math.round(est) - Math.round(wasEst) : 0
                  const heaviest = topSet(entry.sets)
                  return (
                    <div className="log-block" key={entry.logId}>
                      <button
                        type="button"
                        className="log-block-head"
                        onClick={() => push('logDetail', { logId: entry.logId })}
                        aria-label={`${relativeDay(entry.date)}${
                          heaviest ? `, top set ${num(heaviest.weight, 1)} ${profile.units}` : ''
                        }`}
                      >
                        <span className="t-headline truncate" style={{ flex: 1, minWidth: 0 }}>
                          {relativeDay(entry.date)}
                        </span>
                        {est > 0 && (
                          <span className="log-block-est">
                            <span className="eyebrow">e1RM</span> {num(est, 0)}
                            {delta !== 0 && (
                              <span className={delta > 0 ? 'up' : 'down'}> {signed(delta, 0)}</span>
                            )}
                          </span>
                        )}
                        <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />
                      </button>
                      <SetTable sets={entry.sets} units={profile.units} />
                    </div>
                  )
                })}
              </div>
              <div className="list-footer">
                Estimated max per session, and what it moved since the one below it.
              </div>
            </>
          )}
        </div>
      </div>
    </Screen>
  )
}
