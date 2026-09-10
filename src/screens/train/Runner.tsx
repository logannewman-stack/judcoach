import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { ActionSheet, Alert, Sheet } from '../../components/ios/Sheet'
import { NumberPad, RpePicker } from '../../components/NumberPad'
import { toast } from '../../components/ios/Toast'
import { CoachNote } from '../../components/Bits'
import { LastTimeLine, PlateRow, WarmupList } from './parts'
import { useStore } from '../../store/useStore'
import { findSession, isPrSet, lastPerformance, useProgram } from '../../store/selectors'
import { EXERCISES, getExercise } from '../../data/exercises'
import type { LoggedSet, SetPrescription } from '../../domain/types'
import {
  buildWarmup, describeReps, e1RM, formatRpe, resolveSet, rpeToRir,
  sessionTonnage, suggestNextLoad, topSet,
} from '../../domain/strength'
import { formatDuration } from '../../lib/date'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

export function Runner({ weekIndex, sessionId }: { weekIndex: number; sessionId: string }) {
  const program = useProgram()
  const dismiss = useNav((s) => s.dismiss)
  const active = useStore((s) => s.active)
  const startSession = useStore((s) => s.startSession)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const logSet = useStore((s) => s.logSet)
  const removeLoggedSet = useStore((s) => s.removeLoggedSet)
  const setCurrentBlock = useStore((s) => s.setCurrentBlock)
  const swapExercise = useStore((s) => s.swapExercise)
  const startRest = useStore((s) => s.startRest)
  const finishSession = useStore((s) => s.finishSession)
  const discardSession = useStore((s) => s.discardSession)

  const found = findSession(program, weekIndex, sessionId)

  // Opening the runner for a session that isn't already in flight starts it.
  useEffect(() => {
    if (!found) return
    if (!active || active.sessionId !== sessionId) startSession(weekIndex, sessionId)
  }, [found, active, sessionId, weekIndex, startSession])

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) return
    const started = new Date(active.startedAt).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - started) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [active])

  const [showFinish, setShowFinish] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [showSwap, setShowSwap] = useState(false)
  const [editing, setEditing] = useState<LoggedSet | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!found || !active) return null
  const { session, week } = found

  const blockIndex = Math.min(active.currentBlockIndex, session.blocks.length - 1)
  const block = session.blocks[blockIndex]!
  const exerciseId = active.swaps[block.id] ?? block.exerciseId
  const exercise = getExercise(exerciseId)
  const logged = active.entries[block.id] ?? []
  const setIndex = Math.min(logged.length, block.sets.length - 1)
  const isBlockDone = logged.length >= block.sets.length
  const prescription = block.sets[setIndex]!

  const totalSets = session.blocks.reduce((n, b) => n + b.sets.length, 0)
  const doneSets = Object.values(active.entries).reduce((n, sets) => n + sets.length, 0)

  const tm = profile.trainingMaxes[exerciseId]
  const resolved = resolveSet(prescription, {
    trainingMax: tm,
    profile,
    topSetWeight: topSet(logged)?.weight,
  })
  const last = lastPerformance(logs, exerciseId)

  const goToBlock = (i: number) => {
    setCurrentBlock(Math.max(0, Math.min(i, session.blocks.length - 1)))
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="screen" style={{ background: 'var(--grouped)' }}>
      {/* ------------------------------- header ------------------------------ */}
      <div
        style={{
          flex: 'none',
          paddingTop: 'var(--sa-top)',
          background: 'var(--chrome)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backdropFilter: 'saturate(180%) blur(20px)',
          boxShadow: '0 var(--hairline) 0 var(--sep)',
          zIndex: 10,
        }}
      >
        <div className="navbar-inner">
          <div className="navbar-side">
            <button className="nav-btn" type="button" onClick={dismiss} aria-label="Minimise workout">
              <Icon name="chevron.down" size={20} weight={2.6} />
            </button>
          </div>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div className="t-caption1 dim truncate">{session.name} · {week.label.split(' — ')[0]}</div>
            <div className="t-headline mono-nums" style={{ lineHeight: '18px' }}>
              {formatDuration(elapsed)}
            </div>
          </div>
          <div className="navbar-side right">
            <button className="nav-btn strong" type="button" onClick={() => setShowFinish(true)}>
              Finish
            </button>
          </div>
        </div>

        <div style={{ padding: '0 var(--gutter) 8px' }}>
          <div className="track" style={{ height: 4 }}>
            <motion.div
              className="track-fill"
              initial={false}
              animate={{ width: `${(doneSets / totalSets) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            />
          </div>
        </div>

        {/* exercise pager */}
        <div
          style={{
            display: 'flex',
            gap: 7,
            overflowX: 'auto',
            padding: '0 var(--gutter) 9px',
            scrollbarWidth: 'none',
          }}
        >
          {session.blocks.map((b, i) => {
            const ex = getExercise(active.swaps[b.id] ?? b.exerciseId)
            const count = (active.entries[b.id] ?? []).length
            const complete = count >= b.sets.length
            const current = i === blockIndex
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => goToBlock(i)}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 11px',
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: -0.1,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: current ? 'var(--accent)' : complete ? 'rgba(52,199,89,0.16)' : 'var(--fill-3)',
                  color: current ? '#fff' : complete ? 'var(--green)' : 'var(--label-2)',
                }}
              >
                {complete && <Icon name="check" size={11} weight={3} />}
                {ex?.shortName ?? ex?.name ?? '—'}
                <span style={{ opacity: 0.65, fontVariantNumeric: 'tabular-nums' }}>
                  {count}/{b.sets.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* -------------------------------- body ------------------------------- */}
      <div className="scroll" ref={scrollRef}>
        <div style={{ padding: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="gutter">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="t-title1" style={{ letterSpacing: -0.5 }}>
                  {exercise?.name ?? exerciseId}
                </h1>
                <div style={{ marginTop: 4 }}>
                  <LastTimeLine performance={last} units={profile.units} />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-gray btn-sm"
                onClick={() => setShowSwap(true)}
                style={{ flex: 'none' }}
              >
                <Icon name="swap" size={15} weight={2.2} />
                Swap
              </button>
            </div>
            {block.supersetGroup && (
              <div style={{ marginTop: 8 }}>
                <Pill tone="tinted">Superset {block.supersetGroup} — alternate with the next movement</Pill>
              </div>
            )}
          </div>

          {/* ---------------------------- target card -------------------------- */}
          {!isBlockDone && (
            <div className="gutter">
              <div
                className="card"
                style={{
                  margin: 0,
                  padding: '16px 16px 14px',
                  background: 'var(--grouped-2)',
                  border: '1.5px solid var(--accent)',
                }}
              >
                <div className="t-caption1 semibold" style={{ color: 'var(--accent)', letterSpacing: 0.4 }}>
                  SET {setIndex + 1} OF {block.sets.length} · TARGET
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span
                    className="mono-nums"
                    style={{ fontSize: 46, lineHeight: '52px', fontWeight: 700, letterSpacing: -1.4 }}
                  >
                    {resolved.targetWeight != null ? num(resolved.targetWeight, 1) : '—'}
                  </span>
                  <span className="t-title3 dim">{profile.units}</span>
                  <span className="spacer" />
                  <span className="mono-nums" style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6 }}>
                    ×{describeReps(prescription)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {prescription.load.kind === 'percent' && (
                    <Pill tone="tinted">{num(prescription.load.value, 1)}% of TM</Pill>
                  )}
                  {prescription.load.kind === 'backoff' && (
                    <Pill tone="tinted">{prescription.load.pctOfTop}% of top set</Pill>
                  )}
                  {prescription.load.kind === 'rpe' && resolved.targetWeight == null && (
                    <Pill tone="tinted">Work up by feel</Pill>
                  )}
                  {prescription.rpe != null && (
                    <Pill tone={prescription.rpe >= 9 ? 'warn' : 'default'}>
                      {formatRpe(prescription.rpe)}
                      {settings.showRir && ` · ${num(rpeToRir(prescription.rpe), 1)} RIR`}
                    </Pill>
                  )}
                  {prescription.amrap && <Pill tone="warn" icon="flame.fill">AMRAP</Pill>}
                  {prescription.tempo && <Pill>Tempo {prescription.tempo}</Pill>}
                  {tm && <Pill>TM {num(tm, 0)}</Pill>}
                </div>

                {settings.showPlateMath && exercise?.barLoaded && resolved.targetWeight != null && (
                  <div style={{ marginTop: 11 }}>
                    <PlateRow target={resolved.targetWeight} profile={profile} />
                  </div>
                )}

                {prescription.note && (
                  <div className="t-footnote dim" style={{ marginTop: 10 }}>{prescription.note}</div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------- warm-up ---------------------------- */}
          {blockIndex === 0 && logged.length === 0 && exercise?.barLoaded && resolved.targetWeight != null && (
            <div className="gutter">
              <div className="t-caption1 dim semibold" style={{ marginBottom: 6 }}>WARM-UP RAMP</div>
              <WarmupList
                sets={buildWarmup(resolved.targetWeight, profile.barWeight, profile.roundingIncrement)}
                units={profile.units}
              />
            </div>
          )}

          {/* ------------------------------ logger ---------------------------- */}
          {isBlockDone ? (
            <BlockCompleteCard
              logged={logged}
              units={profile.units}
              isLast={blockIndex === session.blocks.length - 1}
              onNext={() => goToBlock(blockIndex + 1)}
              onAddSet={() => {
                // An extra set beyond the prescription is still worth logging.
                const extra = block.sets[block.sets.length - 1]!
                logRawSet(extra, logged[logged.length - 1]?.weight ?? 0, extra.reps, extra.rpe)
              }}
            />
          ) : (
            <SetLogger
              key={`${block.id}-${setIndex}`}
              prescription={prescription}
              blockSets={block.sets}
              resolved={resolved}
              units={profile.units}
              increment={profile.roundingIncrement}
              showRir={settings.showRir}
              lastSet={logged[logged.length - 1]}
              previous={last?.sets[setIndex]}
              onLog={(weight, reps, rpe) => logRawSet(prescription, weight, reps, rpe)}
            />
          )}

          {/* --------------------------- logged sets -------------------------- */}
          {logged.length > 0 && (
            <div className="gutter">
              <div className="t-caption1 dim semibold" style={{ marginBottom: 7 }}>
                LOGGED THIS SESSION
              </div>
              <div className="card" style={{ margin: 0 }}>
                {logged.map((s, i) => {
                  const target = block.sets[i]
                  const pr = isPrSet(logs, exerciseId, s)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="row"
                      onClick={() => setEditing(s)}
                      style={{ ['--row-sep-inset' as string]: '16px' }}
                    >
                      <span
                        style={{
                          width: 26, height: 26, borderRadius: 8, flex: 'none',
                          background: 'rgba(52,199,89,0.16)', display: 'grid', placeItems: 'center',
                        }}
                      >
                        <Icon name="check" size={14} weight={3} color="var(--green)" />
                      </span>
                      <span className="row-body">
                        <span className="row-title mono-nums">
                          {num(s.weight, 1)} {profile.units} × {s.reps}
                          {s.rpe != null && <span className="dim"> @ RPE {num(s.rpe, 1)}</span>}
                        </span>
                        <span className="row-sub">
                          Set {i + 1}
                          {target && ` · target ${describeReps(target)}${target.rpe ? ` @ ${formatRpe(target.rpe)}` : ''}`}
                          {` · e1RM ${num(e1RM(s.weight, s.reps, s.rpe), 0)}`}
                        </span>
                      </span>
                      {pr && <Pill tone="warn" icon="seal.fill">PR</Pill>}
                      <Icon name="pencil" size={15} color="var(--label-3)" weight={2} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ---------------------------- coach note -------------------------- */}
          {block.note && (
            <div className="gutter">
              <CoachNote>{block.note}</CoachNote>
            </div>
          )}
          {exercise && exercise.cues.length > 0 && (
            <div className="gutter">
              <div className="t-caption1 dim semibold" style={{ marginBottom: 6 }}>CUES</div>
              <div className="card" style={{ margin: 0, padding: '11px 14px' }}>
                {exercise.cues.map((cue, i) => (
                  <div
                    key={i}
                    className="t-subhead"
                    style={{ display: 'flex', gap: 8, padding: '3px 0', color: 'var(--label-2)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>•</span>
                    {cue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------- nav feet --------------------------- */}
          <div className="gutter" style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <Button
              variant="gray"
              onPress={() => goToBlock(blockIndex - 1)}
              disabled={blockIndex === 0}
              style={{ flex: 1 }}
            >
              <Icon name="chevron.left" size={16} weight={2.4} />
              Previous
            </Button>
            <Button
              variant={isBlockDone ? 'filled' : 'gray'}
              onPress={() =>
                blockIndex === session.blocks.length - 1 ? setShowFinish(true) : goToBlock(blockIndex + 1)
              }
              style={{ flex: 1 }}
            >
              {blockIndex === session.blocks.length - 1 ? 'Finish' : 'Next'}
              <Icon name="chevron.right" size={16} weight={2.4} />
            </Button>
          </div>

          <div style={{ height: 'calc(var(--sa-bottom) + 82px)' }} />
        </div>
      </div>

      {/* ------------------------------- overlays ---------------------------- */}
      <SwapSheet
        open={showSwap}
        onClose={() => setShowSwap(false)}
        currentId={exerciseId}
        originalId={block.exerciseId}
        onSelect={(id) => {
          swapExercise(block.id, id)
          toast(`Swapped to ${getExercise(id)?.name ?? id}`, { icon: 'swap' })
        }}
      />

      <EditSetSheet
        set={editing}
        units={profile.units}
        increment={profile.roundingIncrement}
        showRir={settings.showRir}
        onClose={() => setEditing(null)}
        onDelete={(id) => {
          removeLoggedSet(block.id, id)
          setEditing(null)
          toast('Set removed', { icon: 'trash', tone: 'bad' })
        }}
        prescriptionId={block.id}
      />

      <FinishSheet
        open={showFinish}
        onClose={() => setShowFinish(false)}
        sessionName={session.name}
        doneSets={doneSets}
        totalSets={totalSets}
        elapsed={elapsed}
        tonnage={Object.values(active.entries).reduce((n, sets) => n + sessionTonnage(sets), 0)}
        units={profile.units}
        onFinish={(sessionRpe, notes) => {
          finishSession({ sessionName: session.name, sessionRpe, notes })
          setShowFinish(false)
          dismiss()
          haptic('success')
          toast('Workout saved', { icon: 'check.circle.fill', tone: 'good' })
        }}
        onDiscard={() => {
          setShowFinish(false)
          setShowDiscard(true)
        }}
      />

      <Alert
        open={showDiscard}
        title="Discard this workout?"
        message="Every set you logged in this session will be deleted. This cannot be undone."
        onDismiss={() => setShowDiscard(false)}
        actions={[
          { label: 'Keep training', onPress: () => setShowDiscard(false) },
          {
            label: 'Discard',
            destructive: true,
            onPress: () => {
              discardSession()
              setShowDiscard(false)
              dismiss()
            },
          },
        ]}
      />
    </div>
  )

  function logRawSet(set: SetPrescription, weight: number, reps: number, rpe?: number) {
    logSet(block.id, { prescriptionId: set.id, weight, reps, rpe })
    haptic('success')
    if (settings.restTimerAuto) {
      const rest = set.restSec ?? exercise?.defaultRestSec ?? 120
      startRest(rest, `${exercise?.shortName ?? exercise?.name ?? 'Rest'} · set ${logged.length + 1}`)
    }
  }
}

/* ---------------------------------- logger ------------------------------- */

function SetLogger({
  prescription, blockSets, resolved, units, increment, showRir, lastSet, previous, onLog,
}: {
  prescription: SetPrescription
  /** Every prescription in this block, so feedback can find the last set's own target. */
  blockSets: SetPrescription[]
  resolved: ReturnType<typeof resolveSet>
  units: string
  increment: number
  showRir: boolean
  lastSet?: LoggedSet
  previous?: LoggedSet
  onLog: (weight: number, reps: number, rpe?: number) => void
}) {
  // Seed from the target, then the previous set, then last time's number.
  const seedWeight = resolved.targetWeight ?? lastSet?.weight ?? previous?.weight ?? 0
  const [weight, setWeight] = useState(seedWeight)
  const [reps, setReps] = useState(prescription.reps)
  const [rpe, setRpe] = useState<number | undefined>(prescription.rpe)
  const [pad, setPad] = useState<'weight' | 'reps' | null>(null)
  const [rpeSheet, setRpeSheet] = useState(false)

  // Judge the set that was just logged against the target it was given — not
  // against the next set's target, which is usually a different rep/percentage.
  const feedback = useMemo(() => {
    if (!lastSet) return null
    const lastTarget = blockSets.find((s) => s.id === lastSet.prescriptionId)
    if (!lastTarget) return null
    const result = suggestNextLoad(
      lastSet,
      { reps: lastTarget.reps, rpe: lastTarget.rpe, weight: lastSet.weight, amrap: lastTarget.amrap },
      increment,
    )
    if (!result || result.direction === 'hold') return null
    // Only an autoregulated set takes a load suggestion; a percentage set's
    // load is set by the training max, so the deviation is information for the
    // coach rather than a number to override.
    const autoregulated = prescription.load.kind === 'rpe'
    return { ...result, autoregulated }
  }, [lastSet, blockSets, increment, prescription.load.kind])

  const plateSteps = increment >= 5 ? [-10, -5, 5, 10] : [-5, -2.5, 2.5, 5]

  return (
    <div className="gutter">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '10px 12px',
              borderRadius: 12,
              background: feedback.direction === 'up' ? 'rgba(52,199,89,0.13)' : 'rgba(255,149,0,0.13)',
              marginBottom: 10,
            }}
          >
            <Icon
              name={feedback.direction === 'up' ? 'arrow.up' : 'arrow.down'}
              size={16}
              weight={2.4}
              color={feedback.direction === 'up' ? 'var(--green)' : 'var(--orange)'}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-footnote semibold">{feedback.reason}</div>
              <div className="t-caption1 dim mono-nums">
                {feedback.autoregulated
                  ? `Suggested: ${num(feedback.suggestedWeight, 1)} ${units}`
                  : 'Logged for Jud — the next set keeps its prescribed percentage.'}
              </div>
            </div>
            {feedback.autoregulated && (
              <button
                type="button"
                className="btn btn-tinted btn-sm"
                onClick={() => setWeight(feedback.suggestedWeight)}
              >
                Use
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card" style={{ margin: 0, padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
          <Field label={`Weight (${units})`} value={num(weight, 1)} onPress={() => setPad('weight')} />
          <Field label="Reps" value={String(reps)} onPress={() => setPad('reps')} />
          <Field
            label={showRir ? 'RPE / RIR' : 'RPE'}
            value={rpe != null ? (showRir ? `${num(rpe, 1)} / ${num(rpeToRir(rpe), 1)}` : num(rpe, 1)) : '—'}
            onPress={() => setRpeSheet(true)}
            tone={rpe != null && prescription.rpe != null && Math.abs(rpe - prescription.rpe) >= 1 ? 'var(--orange)' : undefined}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
          {plateSteps.map((s) => (
            <button
              key={s}
              type="button"
              className="pill"
              onClick={() => {
                haptic('selection')
                setWeight((w) => Math.max(0, Math.round((w + s) * 100) / 100))
              }}
              style={{ fontSize: 14, padding: '7px 13px', background: 'var(--fill-4)', color: 'var(--label)' }}
            >
              {s > 0 ? '+' : '−'}{num(Math.abs(s), 2)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 13 }}>
          <Button
            icon="check"
            onPress={() => onLog(weight, reps, rpe)}
            disabled={reps <= 0}
            style={{ minHeight: 52, fontSize: 18 }}
          >
            Log set
          </Button>
        </div>

        {rpe != null && weight > 0 && reps > 0 && (
          <div className="t-caption1 dim mono-nums" style={{ textAlign: 'center', marginTop: 9 }}>
            Estimated 1RM from this set: {num(e1RM(weight, reps, rpe), 0)} {units}
          </div>
        )}
      </div>

      <NumberPad
        open={pad === 'weight'}
        onClose={() => setPad(null)}
        onSubmit={setWeight}
        title="Weight"
        initial={weight}
        unit={units}
        steps={plateSteps}
        hint={resolved.targetWeight ? `Target ${num(resolved.targetWeight, 1)} ${units}` : undefined}
      />
      <NumberPad
        open={pad === 'reps'}
        onClose={() => setPad(null)}
        onSubmit={(v) => setReps(Math.max(1, Math.round(v)))}
        title="Reps"
        initial={reps}
        allowDecimal={false}
        max={100}
        steps={[-1, 1]}
        hint={`Target ${describeReps(prescription)}${prescription.amrap ? ' (AMRAP)' : ''}`}
      />
      <Sheet
        open={rpeSheet}
        onClose={() => setRpeSheet(false)}
        title="How hard was that set?"
        left={{ label: 'Cancel', onPress: () => setRpeSheet(false) }}
        right={{ label: 'Done', onPress: () => setRpeSheet(false), strong: true }}
        detent={0.55}
      >
        <div style={{ padding: '8px 16px 16px' }}>
          <RpePicker value={rpe} onChange={setRpe} showRir={showRir} target={prescription.rpe} />
          {prescription.rpe != null && (
            <div className="t-footnote dim" style={{ marginTop: 14 }}>
              Jud asked for {formatRpe(prescription.rpe)}
              {showRir && ` (${num(rpeToRir(prescription.rpe), 1)} reps in reserve)`}.
            </div>
          )}
        </div>
      </Sheet>
    </div>
  )
}

function Field({
  label, value, onPress, tone,
}: {
  label: string
  value: string
  onPress: () => void
  tone?: string
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        background: 'var(--fill-4)',
        borderRadius: 12,
        padding: '9px 8px 10px',
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      <div className="t-caption2 dim semibold truncate" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
      <div
        className="mono-nums truncate"
        style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2, color: tone }}
      >
        {value}
      </div>
    </button>
  )
}

/* ------------------------------ block complete --------------------------- */

function BlockCompleteCard({
  logged, units, isLast, onNext, onAddSet,
}: {
  logged: LoggedSet[]
  units: string
  isLast: boolean
  onNext: () => void
  onAddSet: () => void
}) {
  const best = logged.reduce((b, s) => (s.weight > b.weight ? s : b), logged[0]!)
  return (
    <div className="gutter">
      <div className="card" style={{ margin: 0, padding: 16, textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px',
            background: 'rgba(52,199,89,0.16)', display: 'grid', placeItems: 'center',
          }}
        >
          <Icon name="check" size={28} weight={3} color="var(--green)" />
        </motion.div>
        <div className="t-headline">All sets logged</div>
        <div className="t-footnote dim mono-nums" style={{ marginTop: 3 }}>
          {logged.length} sets · top {num(best.weight, 1)} {units} × {best.reps}
          {' · '}
          {num(sessionTonnage(logged), 0)} {units} moved
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
          <Button variant="gray" onPress={onAddSet} style={{ flex: 1 }} small>
            <Icon name="plus" size={15} weight={2.4} />
            Extra set
          </Button>
          {!isLast && (
            <Button onPress={onNext} style={{ flex: 1 }} small>
              Next exercise
              <Icon name="chevron.right" size={15} weight={2.4} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- swap sheet ----------------------------- */

function SwapSheet({
  open, onClose, currentId, originalId, onSelect,
}: {
  open: boolean
  onClose: () => void
  currentId: string
  originalId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const original = getExercise(originalId)
  const suggested = (original?.substituteIds ?? []).map(getExercise).filter(Boolean)
  const results = query.trim()
    ? EXERCISES.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 24)
    : []

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Swap exercise"
      left={{ label: 'Cancel', onPress: onClose }}
      detent={0.85}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="t-footnote dim" style={{ marginBottom: 12 }}>
          Equipment taken or something hurts? Pick a substitute that trains the same pattern.
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all exercises"
          style={{
            width: '100%',
            padding: '10px 13px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--fill-3)',
            marginBottom: 14,
          }}
        />

        {(query.trim() ? results : [original, ...suggested].filter(Boolean)).map((ex) => {
          if (!ex) return null
          const isCurrent = ex.id === currentId
          return (
            <button
              key={ex.id}
              type="button"
              className="row"
              style={{ borderRadius: 10, marginBottom: 2 }}
              onClick={() => {
                onSelect(ex.id)
                onClose()
              }}
            >
              <span className="row-body">
                <span className="row-title">
                  {ex.name}
                  {ex.id === originalId && <span className="dim"> · prescribed</span>}
                </span>
                <span className="row-sub">
                  {ex.primary.join(', ')} · {ex.equipment}
                </span>
              </span>
              {isCurrent && <Icon name="check" size={17} weight={2.6} color="var(--accent)" />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

/* ------------------------------- edit a set ------------------------------ */

function EditSetSheet({
  set, units, increment, showRir, onClose, onDelete, prescriptionId,
}: {
  set: LoggedSet | null
  units: string
  increment: number
  showRir: boolean
  onClose: () => void
  onDelete: (id: string) => void
  prescriptionId: string
}) {
  const updateLoggedSet = useStore((s) => s.updateLoggedSet)
  const [pad, setPad] = useState<'weight' | 'reps' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!set) return null
  const steps = increment >= 5 ? [-10, -5, 5, 10] : [-5, -2.5, 2.5, 5]

  return (
    <>
      <Sheet
        open={!!set}
        onClose={onClose}
        title="Edit set"
        left={{ label: 'Done', onPress: onClose }}
        detent={0.62}
      >
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label={`Weight (${units})`} value={num(set.weight, 1)} onPress={() => setPad('weight')} />
            <Field label="Reps" value={String(set.reps)} onPress={() => setPad('reps')} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="t-caption1 dim semibold" style={{ marginBottom: 8 }}>RPE</div>
            <RpePicker
              value={set.rpe}
              onChange={(v) => updateLoggedSet(prescriptionId, set.id, { rpe: v })}
              showRir={showRir}
            />
          </div>
          <div style={{ marginTop: 18 }}>
            <Button variant="gray" onPress={() => setConfirmDelete(true)}>
              <Icon name="trash" size={17} weight={2} />
              <span style={{ color: 'var(--red)' }}>Delete set</span>
            </Button>
          </div>
        </div>
      </Sheet>

      <NumberPad
        open={pad === 'weight'}
        onClose={() => setPad(null)}
        onSubmit={(v) => updateLoggedSet(prescriptionId, set.id, { weight: v })}
        title="Weight"
        initial={set.weight}
        unit={units}
        steps={steps}
      />
      <NumberPad
        open={pad === 'reps'}
        onClose={() => setPad(null)}
        onSubmit={(v) => updateLoggedSet(prescriptionId, set.id, { reps: Math.max(1, Math.round(v)) })}
        title="Reps"
        initial={set.reps}
        allowDecimal={false}
        max={100}
        steps={[-1, 1]}
      />

      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this set?"
        items={[{ label: 'Delete set', destructive: true, onPress: () => onDelete(set.id) }]}
      />
    </>
  )
}

/* ------------------------------ finish sheet ----------------------------- */

function FinishSheet({
  open, onClose, sessionName, doneSets, totalSets, elapsed, tonnage, units, onFinish, onDiscard,
}: {
  open: boolean
  onClose: () => void
  sessionName: string
  doneSets: number
  totalSets: number
  elapsed: number
  tonnage: number
  units: string
  onFinish: (sessionRpe: number | undefined, notes: string) => void
  onDiscard: () => void
}) {
  const [sessionRpe, setSessionRpe] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Finish workout"
      left={{ label: 'Cancel', onPress: onClose }}
      right={{ label: 'Save', strong: true, onPress: () => onFinish(sessionRpe, notes) }}
      detent={0.86}
    >
      <div style={{ padding: '8px 16px 16px' }}>
        <div className="t-title2" style={{ marginBottom: 2 }}>{sessionName}</div>
        <div className="t-subhead dim">
          {doneSets} of {totalSets} sets logged
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, margin: '16px 0 20px' }}>
          <SummaryTile label="Duration" value={formatDuration(elapsed)} />
          <SummaryTile label="Sets" value={String(doneSets)} />
          <SummaryTile label={`Volume (${units})`} value={num(tonnage, 0)} />
        </div>

        {doneSets < totalSets && (
          <div
            className="t-footnote"
            style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 18,
              background: 'rgba(255,149,0,0.13)', color: 'var(--orange)',
            }}
          >
            {totalSets - doneSets} prescribed sets are still unlogged. Jud will see this session as partial.
          </div>
        )}

        <div className="t-caption1 dim semibold" style={{ marginBottom: 8 }}>
          HOW HARD WAS THE WHOLE SESSION?
        </div>
        <RpePicker value={sessionRpe} onChange={setSessionRpe} showRir={false} />

        <div className="t-caption1 dim semibold" style={{ margin: '18px 0 8px' }}>
          NOTES FOR JUD
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Bar speed, aches, sleep, anything that changed how today felt…"
          style={{
            width: '100%',
            padding: '11px 13px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--fill-3)',
            resize: 'none',
            lineHeight: '22px',
          }}
        />

        <div style={{ marginTop: 18 }}>
          <Button variant="gray" onPress={onDiscard}>
            <span style={{ color: 'var(--red)' }}>Discard workout</span>
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--fill-4)', borderRadius: 12, padding: '10px 10px 11px', textAlign: 'center' }}>
      <div className="t-caption2 dim semibold truncate" style={{ textTransform: 'uppercase' }}>{label}</div>
      <div className="mono-nums" style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}
