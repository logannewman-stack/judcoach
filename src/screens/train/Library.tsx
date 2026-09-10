import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented } from '../../components/ios/Controls'
import { LineChart, Sparkline } from '../../components/Charts'
import { LoggedSetChip } from './parts'
import { useStore } from '../../store/useStore'
import { e1rmSeries, performanceHistory, personalRecords } from '../../store/selectors'
import { EQUIPMENT_LABELS, EXERCISES, MUSCLE_LABELS, getExercise } from '../../data/exercises'
import type { MuscleGroup } from '../../domain/types'
import { bestE1RM } from '../../domain/strength'
import { formatMediumDate, formatShortDate, relativeDay } from '../../lib/date'
import { num, pluralize } from '../../lib/format'
import { useNav } from '../../nav/nav'

/* ------------------------------ the library ----------------------------- */

const GROUPS: { key: string; label: string; muscles: MuscleGroup[] }[] = [
  { key: 'all', label: 'All', muscles: [] },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'] },
  { key: 'push', label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
  { key: 'pull', label: 'Pull', muscles: ['back', 'lats', 'biceps', 'traps', 'forearms'] },
  { key: 'core', label: 'Core', muscles: ['core'] },
]

export function ExerciseLibrary() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const logs = useStore((s) => s.logs)
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

  return (
    <Screen title="Exercises" back={{ label: 'Train', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>Exercises</h1>
          <div className="t-subhead dim" style={{ marginTop: 2 }}>
            {pluralize(EXERCISES.length, 'movement')} with Jud's cues on every one.
          </div>
        </div>

        <div className="gutter">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: 11, pointerEvents: 'none' }}>
              <Icon name="search" size={17} weight={2.2} color="var(--label-3)" />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search exercises"
              style={{
                width: '100%',
                padding: '10px 13px 10px 36px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--fill-3)',
              }}
            />
          </div>
        </div>

        <div className="gutter">
          <Segmented
            options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
            value={group}
            onChange={setGroup}
          />
        </div>

        {results.length === 0 ? (
          <EmptyState icon="search" title="Nothing matches" message="Try a shorter search term." />
        ) : (
          <ListSection>
            {results.map((exercise) => {
              const series = e1rmSeries(logs, exercise.id)
              return (
                <Row
                  key={exercise.id}
                  title={exercise.name}
                  subtitle={`${exercise.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
                  trailing={
                    series.length > 2 ? (
                      <Sparkline values={series.slice(-10).map((p) => p.value)} width={44} height={20} />
                    ) : undefined
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

  if (!exercise) {
    return (
      <Screen title="Exercise" back={{ onPress: pop }}>
        <div className="gutter t-body dim">That movement isn't in the library.</div>
      </Screen>
    )
  }

  const tm = profile.trainingMaxes[exercise.id]

  return (
    <Screen title={exercise.name} back={{ onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6, lineHeight: '40px' }}>
            {exercise.name}
          </h1>
          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            <Pill tone="tinted">{EQUIPMENT_LABELS[exercise.equipment]}</Pill>
            {exercise.primary.map((m) => (
              <Pill key={m}>{MUSCLE_LABELS[m]}</Pill>
            ))}
            {exercise.isMainLift && <Pill tone="warn" icon="bolt.fill">Main lift</Pill>}
          </div>
        </div>

        {/* --------------------------------- PR ----------------------------- */}
        {pr && (
          <div className="gutter">
            <Card style={{ margin: 0, width: '100%' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-footnote dim">Best estimated 1RM</div>
                  <div className="mono-nums" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.7 }}>
                    {num(pr.e1rm, 0)}
                    <span className="t-callout dim" style={{ fontWeight: 400 }}> {profile.units}</span>
                  </div>
                  <div className="t-footnote dim mono-nums" style={{ marginTop: 1 }}>
                    from {num(pr.weight, 1)} × {pr.reps}
                    {pr.rpe != null ? ` @ RPE ${num(pr.rpe, 1)}` : ''} · {formatShortDate(pr.date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="t-footnote dim">Heaviest</div>
                  <div className="mono-nums t-title3">{num(pr.topWeight, 0)}</div>
                  {tm && (
                    <>
                      <div className="t-footnote dim" style={{ marginTop: 6 }}>Training max</div>
                      <div className="mono-nums t-title3">{num(tm, 0)}</div>
                    </>
                  )}
                </div>
              </div>
            </Card>
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
                <div className="t-caption1 dim semibold" style={{ marginBottom: 4 }}>SET-UP</div>
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
            <div className="t-caption1 dim" style={{ marginTop: 10 }}>
              Rest {Math.round(exercise.defaultRestSec / 60)}–{Math.ceil(exercise.defaultRestSec / 60) + 1} minutes
              between working sets.
            </div>
          </Card>
        </div>

        {/* ----------------------------- substitutes ------------------------ */}
        {exercise.substituteIds && exercise.substituteIds.length > 0 && (
          <ListSection header="If it's taken or it hurts">
            {exercise.substituteIds.map((id) => {
              const sub = getExercise(id)
              if (!sub) return null
              return (
                <Row
                  key={id}
                  title={sub.name}
                  subtitle={`${sub.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${EQUIPMENT_LABELS[sub.equipment]}`}
                  chevron
                  onPress={() => push('exerciseDetail', { exerciseId: id })}
                />
              )
            })}
          </ListSection>
        )}

        {/* ------------------------------ history --------------------------- */}
        <div>
          <SectionHeader title="Your history" />
          {history.length === 0 ? (
            <EmptyState icon="clock" title="Not trained yet" message="It'll show up here after your first logged set." />
          ) : (
            <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.slice(0, 12).map((entry) => (
                <div key={entry.logId} className="card" style={{ margin: 0, padding: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span className="t-subhead semibold">{relativeDay(entry.date)}</span>
                    <span className="t-caption1 dim mono-nums">
                      e1RM {num(bestE1RM(entry.sets), 0)} · {formatMediumDate(entry.date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {entry.sets.map((s) => (
                      <LoggedSetChip key={s.id} set={s} units={profile.units} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
