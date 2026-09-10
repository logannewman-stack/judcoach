import { useMemo } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, CoachNote, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { BlockHeading, LastTimeLine, LoggedSetChip, PlateRow, TargetSummary, WarmupList, setLabel } from './parts'
import { useStore } from '../../store/useStore'
import { findSession, lastPerformance, sessionDate, useProgram } from '../../store/selectors'
import { getExercise } from '../../data/exercises'
import { buildWarmup, resolveSet, topSet } from '../../domain/strength'
import { formatMediumDate, formatMinutes, todayISO } from '../../lib/date'
import { navPresent, useNav } from '../../nav/nav'

export function SessionDetail({ weekIndex, sessionId }: { weekIndex: number; sessionId: string }) {
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const showRir = useStore((s) => s.settings.showRir)
  const showPlates = useStore((s) => s.settings.showPlateMath)
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)

  const found = findSession(program, weekIndex, sessionId)
  const log = logs.find((l) => l.sessionId === sessionId)
  const date = found ? sessionDate(program, weekIndex, found.session.weekday) : todayISO()

  const totalSets = useMemo(
    () => found?.session.blocks.reduce((n, b) => n + b.sets.length, 0) ?? 0,
    [found],
  )

  if (!found) {
    return (
      <Screen title="Session" back={{ onPress: pop }}>
        <div className="gutter t-body dim">This session is no longer in your programme.</div>
      </Screen>
    )
  }

  const { week, session } = found

  return (
    <Screen
      title={session.name}
      back={{ label: 'Train', onPress: pop }}
      largeTitle={false}
      right={log ? { label: 'Log', onPress: () => push('logDetail', { logId: log.id }) } : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        {/* ------------------------------- header ------------------------------ */}
        <div className="gutter">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <Pill tone="tinted">{week.label.split(' — ')[0]}</Pill>
            {week.deload && <Pill>Deload</Pill>}
            {log && <Pill tone="good" icon="check">Completed</Pill>}
          </div>
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>{session.name}</h1>
          <div className="t-subhead dim" style={{ marginTop: 2 }}>{session.focus}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            <Meta icon="calendar" text={formatMediumDate(date)} />
            <Meta icon="clock" text={formatMinutes(session.estMinutes * 60)} />
            <Meta icon="list" text={`${session.blocks.length} exercises · ${totalSets} sets`} />
          </div>
        </div>

        {session.coachNote && (
          <div className="gutter">
            <CoachNote>{session.coachNote}</CoachNote>
          </div>
        )}

        {!log && (
          <div className="gutter">
            <Button icon="play.fill" onPress={() => navPresent('runner', { weekIndex, sessionId })}>
              Start workout
            </Button>
          </div>
        )}

        {/* ------------------------------- blocks ------------------------------ */}
        <div>
          <SectionHeader title="The work" />
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {session.blocks.map((block, blockIndex) => {
              const exercise = getExercise(block.exerciseId)
              const tm = profile.trainingMaxes[block.exerciseId]
              const last = lastPerformance(logs, block.exerciseId, date)
              const logged = log?.exercises.find((e) => e.exerciseId === block.exerciseId)

              // Back-off percentages need the top set; before the session runs,
              // estimate it from the heaviest prescribed set.
              const resolvedSets = block.sets.map((set, i) => {
                const priorTop = block.sets
                  .slice(0, i)
                  .map((s) => resolveSet(s, { trainingMax: tm, profile }).targetWeight ?? 0)
                  .reduce((a, b) => Math.max(a, b), 0)
                return resolveSet(set, { trainingMax: tm, profile, topSetWeight: priorTop || undefined })
              })
              const heaviest = resolvedSets.reduce(
                (best, r) => ((r.targetWeight ?? 0) > (best.targetWeight ?? 0) ? r : best),
                resolvedSets[0]!,
              )
              const warmup = exercise?.barLoaded && heaviest.targetWeight
                ? buildWarmup(heaviest.targetWeight, profile.barWeight, profile.roundingIncrement)
                : []

              return (
                <div key={block.id} className="card" style={{ margin: 0, padding: 14 }}>
                  <BlockHeading
                    index={blockIndex + 1}
                    name={
                      <button
                        type="button"
                        onClick={() => push('exerciseDetail', { exerciseId: block.exerciseId })}
                        style={{ textAlign: 'left', color: 'inherit', font: 'inherit' }}
                      >
                        {exercise?.name ?? block.exerciseId}
                      </button>
                    }
                    supersetGroup={block.supersetGroup}
                    right={
                      <button
                        type="button"
                        aria-label="Exercise details"
                        onClick={() => push('exerciseDetail', { exerciseId: block.exerciseId })}
                      >
                        <Icon name="info" size={17} color="var(--label-3)" weight={2} />
                      </button>
                    }
                  />

                  <div style={{ marginTop: 8, marginLeft: 31 }}>
                    <LastTimeLine performance={last} units={profile.units} />
                  </div>

                  {blockIndex === 0 && warmup.length > 0 && (
                    <div style={{ marginTop: 11, marginLeft: 31 }}>
                      <div className="t-caption1 dim semibold" style={{ marginBottom: 5 }}>WARM-UP</div>
                      <WarmupList sets={warmup} units={profile.units} />
                    </div>
                  )}

                  <div style={{ marginTop: 12, marginLeft: 31, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {block.sets.map((set, i) => (
                      <div key={set.id}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span className="t-caption1 dim semibold" style={{ minWidth: 52 }}>
                            {setLabel(set, i)}
                          </span>
                        </div>
                        <TargetSummary resolved={resolvedSets[i]!} units={profile.units} showRir={showRir} />
                        {set.note && (
                          <div className="t-caption1 dim" style={{ marginTop: 3 }}>{set.note}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {showPlates && exercise?.barLoaded && heaviest.targetWeight && (
                    <div style={{ marginTop: 12, marginLeft: 31 }}>
                      <PlateRow target={heaviest.targetWeight} profile={profile} />
                    </div>
                  )}

                  {block.note && (
                    <div className="t-footnote dim" style={{ marginTop: 11, marginLeft: 31 }}>
                      {block.note}
                    </div>
                  )}

                  {logged && logged.sets.length > 0 && (
                    <div style={{ marginTop: 12, marginLeft: 31 }}>
                      <div className="t-caption1 semibold" style={{ color: 'var(--green)', marginBottom: 6 }}>
                        WHAT YOU DID
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {logged.sets.map((s) => (
                          <LoggedSetChip key={s.id} set={s} units={profile.units} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {log && (
          <div className="gutter">
            <Card>
              <div className="t-footnote dim">
                Logged {formatMediumDate(log.date)}
                {log.durationSec ? ` · ${formatMinutes(log.durationSec)}` : ''}
                {(() => {
                  const top = log.exercises[0] ? topSet(log.exercises[0].sets) : undefined
                  return top ? ` · top set ${top.weight} ${profile.units} × ${top.reps}` : ''
                })()}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Screen>
  )
}

function Meta({ icon, text }: { icon: 'calendar' | 'clock' | 'list'; text: string }) {
  return (
    <span className="t-footnote dim" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={13} weight={2.1} color="var(--label-3)" />
      {text}
    </span>
  )
}
