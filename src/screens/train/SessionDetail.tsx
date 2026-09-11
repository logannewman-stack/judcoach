import { Fragment, useMemo } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, CoachNote, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { LastTimeLine, LoggedSetChip, SupersetTag, WarmupList } from './parts'
import { resolvePrescription, topPrescribedSet } from './prescription'
import { Barbell } from '../../components/Barbell'
import { useStore } from '../../store/useStore'
import { findSession, lastPerformance, sessionDate, useProgram } from '../../store/selectors'
import { getExercise } from '../../data/exercises'
import type { ResolvedSet } from '../../domain/strength'
import type { Units } from '../../domain/types'
import { buildWarmup, formatRpe, rpeToRir, topSet } from '../../domain/strength'
import { formatMediumDate, formatMinutes, todayISO } from '../../lib/date'
import { fixed, num } from '../../lib/format'
import { navPresent, useNav } from '../../nav/nav'
import '../../styles/today.css'

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
  const top = topPrescribedSet(session.blocks[0], profile)
  // Same rule as Today's hero: with no working max on file the load is a
  // percentage of nothing, and dropping it leaves "5 reps" reading as the whole
  // prescription. The share is the half that is true either way, so it takes
  // the figure's place and the line under it names what it is a share of.
  const topPending = top != null && top.targetWeight == null && top.percent != null

  return (
    <Screen
      title={session.name}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter session-screen" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim">{session.focus}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
            <Pill tone="tinted">{week.label.split(' — ')[0]}</Pill>
            {week.deload && <Pill>Deload</Pill>}
            {log && <Pill tone="good" icon="check">Completed</Pill>}
          </div>
          {/* The heaviest set the session asks for, which is the one thing a
              lifter wants off this screen before anything else on it — so it
              gets the ramp's own wash and the biggest figure on the page. */}
          {top && (
            <div className="today-top" data-size="sm" data-rpe={top.rpe ?? ''} style={{ marginTop: 13 }}>
              <span className="eyebrow today-top-label">Top set</span>
              {top.rpe != null ? (
                <span className="rpe-ink today-top-rpe">
                  <span className="today-top-pip" aria-hidden="true" />
                  {formatRpe(top.rpe)}
                </span>
              ) : (
                <span className="today-top-rpe t-footnote dim">{top.loadLabel}</span>
              )}
              <span className="today-top-figure figure">
                {top.targetWeight != null ? (
                  <>
                    {num(top.targetWeight, 1)}
                    <span className="figure-unit"> {profile.units}</span>
                    <span className="today-top-x">×</span>
                    {top.repsLabel}
                  </>
                ) : topPending ? (
                  <>
                    {num(top.percent!, 1)}
                    <span className="figure-unit">%</span>
                    <span className="today-top-x">×</span>
                    {top.repsLabel}
                  </>
                ) : (
                  <>
                    {top.repsLabel}
                    <span className="figure-unit"> reps</span>
                  </>
                )}
              </span>
              {topPending && (
                <span className="today-top-pending t-caption1">
                  of your working max, which has no number on it yet
                </span>
              )}
            </div>
          )}
          <div className="t-footnote dim" style={{ marginTop: 12 }}>
            <span className="data">{formatMediumDate(date)}</span> ·{' '}
            <span className="data">{formatMinutes(session.estMinutes * 60)}</span> ·{' '}
            <span className="data">{session.blocks.length}</span> exercises ·{' '}
            <span className="data">{totalSets}</span> sets
          </div>
        </div>
      }
      right={log ? { label: 'Log', onPress: () => push('logDetail', { logId: log.id }) } : undefined}
    >
      <div className="session-screen" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* The action comes before the reading: this screen exists to be walked
            into a gym, and Jud's note is the thing you read on the way. */}
        {!log && (
          <div className="gutter">
            <Button icon="play.fill" onPress={() => navPresent('runner', { weekIndex, sessionId })}>
              Start workout
            </Button>
          </div>
        )}

        {session.coachNote && (
          <div className="gutter">
            <CoachNote>{session.coachNote}</CoachNote>
          </div>
        )}

        {/* ------------------------------- blocks ------------------------------ */}
        <div>
          <SectionHeader title="The work" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {session.blocks.map((block, blockIndex) => {
              const exercise = getExercise(block.exerciseId)
              const last = lastPerformance(logs, block.exerciseId, date)
              const logged = log?.exercises.find((e) => e.exerciseId === block.exerciseId)

              const resolved = resolvePrescription(block, profile)
              const heaviest = resolved.reduce(
                (best, r) => ((r.targetWeight ?? 0) > (best.targetWeight ?? 0) ? r : best),
                resolved[0]!,
              )
              const warmup = exercise?.barLoaded && heaviest.targetWeight
                ? buildWarmup(heaviest.targetWeight, profile.barWeight, profile.roundingIncrement)
                : []
              const tempo = resolved[0]?.prescription.tempo
              const sharedTempo = tempo && resolved.every((r) => r.prescription.tempo === tempo)

              return (
                <Card key={block.id}>
                  {/* The movement's place in the session, in the screen's own
                      hue — a grey pip in front of every exercise was the last
                      thing on this page with no reason to be grey. */}
                  <div className="plan-head">
                    <span className="plan-index" aria-hidden="true">{blockIndex + 1}</span>
                    <button
                      type="button"
                      className="t-headline truncate hit-expand"
                      onClick={() => push('exerciseDetail', { exerciseId: block.exerciseId })}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }}
                    >
                      {exercise?.name ?? block.exerciseId}
                    </button>
                    {block.supersetGroup && <SupersetTag group={block.supersetGroup} />}
                    <button
                      type="button"
                      aria-label={`About ${exercise?.name ?? block.exerciseId}`}
                      className="hit-expand"
                      onClick={() => push('exerciseDetail', { exerciseId: block.exerciseId })}
                    >
                      <Icon name="info" size={18} color="var(--label-3)" weight={2} />
                    </button>
                  </div>

                  <div style={{ marginTop: 9 }}>
                    <LastTimeLine performance={last} units={profile.units} />
                  </div>

                  {blockIndex === 0 && warmup.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>Warm-up</div>
                      <WarmupList sets={warmup} units={profile.units} />
                    </div>
                  )}

                  <PlanTable
                    rows={groupSets(resolved)}
                    label={exercise?.name ?? block.exerciseId}
                    units={profile.units}
                    showRir={showRir}
                  />

                  {(sharedTempo || block.note) && (
                    <div className="plan-foot">
                      {sharedTempo && (
                        <span className="t-footnote dim">
                          Tempo <span className="data">{tempo}</span>
                        </span>
                      )}
                      {block.note && <span className="t-footnote dim">{block.note}</span>}
                    </div>
                  )}

                  {showPlates && exercise?.barLoaded && heaviest.targetWeight && (
                    <div style={{ marginTop: 14 }}>
                      <Barbell target={heaviest.targetWeight} profile={profile} height={52} />
                    </div>
                  )}

                  {logged && logged.sets.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="eyebrow" style={{ marginBottom: 7 }}>What you did</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {logged.sets.map((s) => (
                          <LoggedSetChip key={s.id} set={s} units={profile.units} />
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
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
                  const best = log.exercises[0] ? topSet(log.exercises[0].sets) : undefined
                  return best ? ` · top set ${best.weight} ${profile.units} × ${best.reps}` : ''
                })()}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Screen>
  )
}

/* ------------------------------ the plan --------------------------------- */

interface PlanRow {
  /** "1", or "1–3" where a run of sets asks for exactly the same thing. */
  label: string
  set: ResolvedSet
}

/**
 * Consecutive sets that ask for the same thing are one row.
 *
 * A coach writes "3 × 8 @ RPE 8", not three identical sentences, and reading
 * the same line three times is how a lifter loses their place in a ladder where
 * the sets genuinely do differ.
 */
function groupSets(sets: ResolvedSet[]): PlanRow[] {
  const rows: PlanRow[] = []
  let start = 0
  const same = (a: ResolvedSet, b: ResolvedSet) =>
    a.repsLabel === b.repsLabel
    && a.targetWeight === b.targetWeight
    && a.loadLabel === b.loadLabel
    && a.percent === b.percent
    && a.rpe === b.rpe
    && a.prescription.amrap === b.prescription.amrap
    && a.prescription.note === b.prescription.note

  for (let i = 0; i < sets.length; i++) {
    const next = sets[i + 1]
    if (next && same(sets[i]!, next)) continue
    rows.push({
      label: start === i ? String(i + 1) : `${start + 1}–${i + 1}`,
      set: sets[i]!,
    })
    start = i + 1
  }
  return rows
}

function PlanTable({
  rows, label, units, showRir,
}: {
  rows: PlanRow[]
  label: string
  units: Units
  showRir: boolean
}) {
  // The column only exists for a programme that loads off a training max; an
  // accessory movement has no percentage to report and should not carry a
  // column of dashes to prove it.
  const hasPercent = rows.some((r) => r.set.percent != null && r.set.prescription.load.kind === 'percent')

  return (
    <div className="plan-wrap">
      <table className="plan" aria-label={`${label} — prescribed sets`}>
        <thead>
          <tr>
            <th className="eyebrow plan-set">Set</th>
            <th className="eyebrow plan-reps">Reps</th>
            <th className="eyebrow plan-load">Load</th>
            {hasPercent && <th className="eyebrow plan-pct">%TM</th>}
            <th className="eyebrow plan-effort">{showRir ? 'RPE · RIR' : 'RPE'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { set } = row
            const { prescription: rx } = set
            return (
              <Fragment key={rx.id}>
                <tr data-rpe={set.rpe ?? ''}>
                  <td className="data plan-set">{row.label}</td>
                  <td className="data plan-reps">
                    {set.repsLabel}
                    {rx.amrap && <span className="eyebrow plan-tag">AMRAP</span>}
                  </td>
                  <td className="data plan-load">
                    {set.targetWeight != null ? (
                      <>
                        {num(set.targetWeight, 1)}
                        <span className="plan-unit"> {units}</span>
                      </>
                    ) : (
                      <span className="plan-words">{set.loadLabel}</span>
                    )}
                  </td>
                  {/* Always one decimal: in a column that drops it, 85% sits a
                      digit to the left of 83.7%. */}
                  {hasPercent && (
                    <td className="data plan-pct">{set.percent != null ? `${fixed(set.percent, 1)}%` : '—'}</td>
                  )}
                  {/* The effort as the ramp's own chip, the way a logged set
                      carries it, so the shape of a session is readable straight
                      down the column rather than word by word. */}
                  <td className="plan-effort">
                    {set.rpe != null ? (
                      <span className="plan-rpe data">
                        {num(set.rpe, 1)}
                        {showRir && <span className="plan-unit"> · {num(rpeToRir(set.rpe), 1)}</span>}
                      </span>
                    ) : (
                      <span className="plan-unit">—</span>
                    )}
                  </td>
                </tr>
                {/* A set's own note goes under its row rather than into a column
                    of its own: it is a sentence, and the rest of this is not. */}
                {rx.note && (
                  <tr>
                    <td className="plan-note" colSpan={hasPercent ? 5 : 4}>{rx.note}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
