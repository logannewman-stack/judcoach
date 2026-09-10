import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { ActionSheet, Alert, Sheet } from '../../components/ios/Sheet'
import { NumberPad, RpePicker } from '../../components/NumberPad'
import { SearchField } from '../../components/ios/SearchField'
import { toast } from '../../components/ios/Toast'
import { CoachNote } from '../../components/Bits'
import { LastTimeLine } from './parts'
import { Barbell } from '../../components/Barbell'
import { WarmupRamp } from './WarmupRamp'
import { useStore } from '../../store/useStore'
import { bestHistoricalE1RM, findSession, lastPerformance, useProgram } from '../../store/selectors'
import { EXERCISES, getExercise } from '../../data/exercises'
import type { ActiveSession, LoggedSet, SetPrescription } from '../../domain/types'
import {
  MAX_RPE, MIN_RPE, buildWarmup, describeReps, e1RM, formatRir, formatRpe, isEstimable, isMaxEffort,
  resolveSet, rpeToRir, sessionTonnage, suggestNextLoad, topSet,
} from '../../domain/strength'
import { formatDuration } from '../../lib/date'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'
import { useFullScreenDrag } from '../../nav/FullScreenDrag'
import '../../styles/runner.css'

export function Runner({ weekIndex, sessionId }: { weekIndex: number; sessionId: string }) {
  const program = useProgram()
  const dismiss = useNav((s) => s.dismiss)
  const present = useNav((s) => s.present)
  const active = useStore((s) => s.active)
  const startSession = useStore((s) => s.startSession)
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const logSet = useStore((s) => s.logSet)
  const removeLoggedSet = useStore((s) => s.removeLoggedSet)
  const setCurrentBlock = useStore((s) => s.setCurrentBlock)
  const swapExercise = useStore((s) => s.swapExercise)
  const setBlockNote = useStore((s) => s.setBlockNote)
  const setWarmupsDone = useStore((s) => s.setWarmupsDone)
  const startRest = useStore((s) => s.startRest)
  const finishSession = useStore((s) => s.finishSession)
  const discardSession = useStore((s) => s.discardSession)

  const found = findSession(program, weekIndex, sessionId)
  const [conflict, setConflict] = useState<ActiveSession | null>(null)
  // True once this runner has actually held its session. The component stays
  // mounted through the dismiss animation, so without this the start effect
  // fires again on the now-null active session and resurrects the workout that
  // was just saved or discarded.
  const heldSessionRef = useRef(false)

  useEffect(() => {
    if (!found) return
    if (active?.sessionId === sessionId) {
      heldSessionRef.current = true
      return
    }
    // The session ended while this runner was still on screen — let it go.
    if (heldSessionRef.current) return
    // A different workout is already in flight; it must not be overwritten.
    if (active) {
      setConflict(active)
      return
    }
    startSession(weekIndex, sessionId)
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
  const [showNote, setShowNote] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [extraSets, setExtraSets] = useState<Record<string, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagerRef = useRef<HTMLDivElement>(null)
  const dragControls = useFullScreenDrag()

  // The pager is the map of the session, so the exercise you are on has to be
  // on it — moving with the feet of the screen used to leave the current chip
  // scrolled off to the right.
  const activeBlockIndex = active?.currentBlockIndex ?? 0
  useEffect(() => {
    const pager = pagerRef.current
    const chip = pager?.children[activeBlockIndex] as HTMLElement | undefined
    if (!pager || !chip) return
    pager.scrollTo({
      left: chip.offsetLeft - (pager.clientWidth - chip.offsetWidth) / 2,
      behavior: scrollBehaviour(),
    })
  }, [activeBlockIndex])

  if (!found || !active) return null
  const { session, week } = found

  const blockIndex = Math.min(active.currentBlockIndex, session.blocks.length - 1)
  const block = session.blocks[blockIndex]!
  const exerciseId = active.swaps[block.id] ?? block.exerciseId
  const exercise = getExercise(exerciseId)
  const logged = active.entries[block.id] ?? []
  // An extra set repeats the last prescription rather than logging a silent
  // duplicate of what was just done.
  const allowedSets = block.sets.length + (extraSets[block.id] ?? 0)
  const setIndex = Math.min(logged.length, block.sets.length - 1)
  const isBlockDone = logged.length >= allowedSets
  const prescription = block.sets[setIndex]!
  const editing = logged.find((x) => x.id === editingId) ?? null

  const totalSets = session.blocks.reduce((n, b) => n + b.sets.length, 0)
  const doneSets = Object.values(active.entries).reduce((n, sets) => n + sets.length, 0)
  const sessionVolume = Object.values(active.entries).reduce((n, sets) => n + sessionTonnage(sets), 0)

  // A set is a record only if it beats everything before it — history *and*
  // whatever has already been put on the bar this session.
  const historicalBest = bestHistoricalE1RM(logs, exerciseId)
  let runningBest = historicalBest
  const prFlags = logged.map((set) => {
    const est = isMaxEffort(set) ? e1RM(set.weight, set.reps, set.rpe) : 0
    // The very first qualifying set establishes the baseline; badging it — and
    // then every set after it — reads as broken rather than encouraging.
    const isPr = est > 0 && runningBest > 0 && est > runningBest + 0.01
    if (est > runningBest) runningBest = est
    return isPr
  })

  // The percentage belongs to the prescribed lift, not the substitute, so a
  // swap keeps its load target instead of collapsing to a bare dash.
  const swapped = exerciseId !== block.exerciseId
  const tm = profile.trainingMaxes[exerciseId] ?? profile.trainingMaxes[block.exerciseId]
  const resolved = resolveSet(prescription, {
    trainingMax: tm,
    profile,
    topSetWeight: topSet(logged)?.weight,
  })
  const last = lastPerformance(logs, exerciseId)
  // What to put on the bar when the programme doesn't dictate a load: the set
  // already done this session, else the same set number last time, else the
  // heaviest set last time. A bodyweight lift logs zeroes, and a zero is not a
  // load anyone is aiming at, so it never becomes the number on the card.
  const anchorWeight =
    loaded(logged[logged.length - 1]?.weight)
    ?? loaded(last?.sets[setIndex]?.weight)
    ?? loaded(last?.sets.length ? Math.max(...last.sets.map((x) => x.weight)) : undefined)
  // Nothing to load means the rep target is the target, so the card leads with
  // reps and the entry field asks for added weight rather than weight.
  const bodyweight = prescription.load.kind === 'bodyweight'

  const sessionComplete = session.blocks.every(
    (b) => (active.entries[b.id] ?? []).length >= b.sets.length,
  )

  const goToBlock = (i: number) => {
    setCurrentBlock(Math.max(0, Math.min(i, session.blocks.length - 1)))
    scrollRef.current?.scrollTo({ top: 0, behavior: scrollBehaviour() })
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
        <div
          className="navbar-inner"
          onPointerDown={(e) => {
            // Pull down on the toolbar to minimise, as iOS full-screen covers do.
            if (e.target instanceof Element && e.target.closest('button')) return
            dragControls?.start(e)
          }}
          style={{ touchAction: 'pan-x' }}
        >
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

        <div style={{ padding: '0 var(--gutter) 5px' }}>
          <div className="track" style={{ height: 4 }}>
            <motion.div
              className="track-fill"
              initial={false}
              animate={{ width: `${(doneSets / totalSets) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            />
          </div>
        </div>

        {/* Exercise pager. The chips are the only way between exercises without
            scrolling to the feet of the screen, so they are sized as targets
            (44pt) rather than as labels, and the rows above give back the height
            that costs. */}
        <div className="hscroll" ref={pagerRef} style={{ gap: 7, paddingBottom: 6 }}>
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
                  padding: '11px 13px',
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
      <div className="scroll runner-scroll" ref={scrollRef}>
        <div style={{ padding: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gutter runner-head">
            {/* The name shares its line with the two rare actions so the history
                line below gets the full width — at 217pt it used to wrap, and
                the word it broke off onto the second line was "ago". */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="t-title1 runner-title" style={{ textWrap: 'balance' }}>
                {exercise?.name ?? exerciseId}
              </h1>
              <button
                type="button"
                className="runner-tool icon-only"
                aria-label="Note for this exercise"
                data-on={!!active.notes[block.id]}
                onClick={() => setShowNote(true)}
              >
                <Icon name="pencil" size={17} weight={2.2} />
              </button>
              <button
                type="button"
                className="runner-tool"
                aria-label="Swap exercise"
                onClick={() => setShowSwap(true)}
              >
                <Icon name="swap" size={17} weight={2.2} />
                <span>Swap</span>
              </button>
            </div>
            <div style={{ marginTop: 3 }}>
              <LastTimeLine performance={last} units={profile.units} />
            </div>
            {block.supersetGroup && (() => {
              const partnerIndex = session.blocks.findIndex(
                (b) => b.supersetGroup === block.supersetGroup && b.id !== block.id,
              )
              const partner = session.blocks[partnerIndex]
              const partnerEx = partner
                ? getExercise(active.swaps[partner.id] ?? partner.exerciseId)
                : undefined
              return (
                <button
                  type="button"
                  onClick={() => partnerIndex >= 0 && goToBlock(partnerIndex)}
                  disabled={partnerIndex < 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    marginTop: 10, padding: '13px 11px', borderRadius: 10,
                    background: 'var(--accent-soft)', textAlign: 'left',
                  }}
                >
                  <Icon name="swap" size={14} weight={2.4} color="var(--accent)" />
                  <span className="t-footnote" style={{ flex: 1, minWidth: 0 }}>
                    <span className="semibold" style={{ color: 'var(--accent)' }}>
                      Superset {block.supersetGroup}
                    </span>
                    {partnerEx ? ` — alternate with ${partnerEx.shortName ?? partnerEx.name}` : ''}
                  </span>
                  {partnerIndex >= 0 && (
                    <Icon name="chevron.right" size={13} weight={2.6} color="var(--accent)" />
                  )}
                </button>
              )
            })()}
            {active.notes[block.id] && (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%',
                  marginTop: 10, padding: '9px 11px', borderRadius: 10,
                  background: 'var(--fill-4)', textAlign: 'left',
                }}
              >
                <Icon name="pencil" size={13} weight={2.2} color="var(--label-3)" style={{ marginTop: 2 }} />
                <span className="t-footnote" style={{ lineHeight: '18px' }}>{active.notes[block.id]}</span>
              </button>
            )}
          </div>

          {/* ---------------------------- target card -------------------------- */}
          {!isBlockDone && (
            <div className="gutter">
              <motion.div
                key={`${block.id}-${setIndex}`}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="card"
                style={{
                  margin: 0,
                  padding: '13px 15px 12px',
                  background: 'var(--grouped-2)',
                  border: '1.5px solid var(--accent)',
                }}
              >
                <div className="t-caption1 semibold" style={{ color: 'var(--accent)', letterSpacing: 0.4 }}>
                  SET {setIndex + 1} OF {block.sets.length} · TARGET
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                  <span
                    className="mono-nums"
                    style={{
                      fontSize: 46,
                      lineHeight: '52px',
                      fontWeight: 700,
                      letterSpacing: -1.4,
                      // An autoregulated lift has no prescribed load, so the
                      // anchor comes from history and is shown as a reference
                      // rather than an instruction.
                      color: !bodyweight && resolved.targetWeight == null && anchorWeight != null
                        ? 'var(--label-2)'
                        : undefined,
                    }}
                  >
                    {bodyweight
                      ? describeReps(prescription)
                      : resolved.targetWeight != null
                        ? num(resolved.targetWeight, 1)
                        : anchorWeight != null
                          ? num(anchorWeight, 1)
                          : '—'}
                  </span>
                  <span className="t-title3 dim">{bodyweight ? 'reps' : profile.units}</span>
                  {!bodyweight && resolved.targetWeight == null && anchorWeight != null && (
                    <span className="t-caption1 dim">last time</span>
                  )}
                  <span className="spacer" />
                  {!bodyweight && (
                    <span className="mono-nums" style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6 }}>
                      ×{describeReps(prescription)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                  {bodyweight && <Pill tone="tinted">Bodyweight</Pill>}
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
                      {settings.showRir && ` · ${formatRir(rpeToRir(prescription.rpe))}`}
                    </Pill>
                  )}
                  {prescription.amrap && <Pill tone="warn" icon="flame.fill">AMRAP</Pill>}
                  {prescription.tempo && <Pill>Tempo {prescription.tempo}</Pill>}
                  {tm && <Pill>Max {num(tm, 0)}</Pill>}
                  {swapped && (
                    <Pill tone="warn">
                      Carried from {getExercise(block.exerciseId)?.shortName
                        ?? getExercise(block.exerciseId)?.name}
                    </Pill>
                  )}
                </div>

                {settings.showPlateMath && exercise?.barLoaded && resolved.targetWeight != null && (
                  <div
                    style={{
                      marginTop: 11,
                      paddingTop: 11,
                      borderTop: 'var(--hairline) solid var(--sep)',
                    }}
                  >
                    <Barbell target={resolved.targetWeight} profile={profile} height={50} />
                  </div>
                )}

                {prescription.note && (
                  <div className="t-footnote dim" style={{ marginTop: 9 }}>{prescription.note}</div>
                )}
              </motion.div>
            </div>
          )}

          {/* ----------------------------- warm-up ---------------------------- */}
          {logged.length === 0 && exercise?.barLoaded && resolved.targetWeight != null && (
            <div className="gutter">
              <WarmupRamp
                sets={buildWarmup(resolved.targetWeight, profile.barWeight, profile.roundingIncrement)}
                units={profile.units}
                done={active.warmups?.[block.id] ?? 0}
                onChange={(count) => setWarmupsDone(block.id, count)}
              />
            </div>
          )}

          {/* ------------------------------ logger ---------------------------- */}
          {isBlockDone ? (
            <BlockCompleteCard
              logged={logged}
              units={profile.units}
              sessionName={session.name}
              nextExercise={
                blockIndex < session.blocks.length - 1
                  ? nameOf(session.blocks[blockIndex + 1]!)
                  : undefined
              }
              sessionComplete={sessionComplete}
              elapsed={elapsed}
              sessionSets={doneSets}
              sessionVolume={sessionVolume}
              onNext={() => goToBlock(blockIndex + 1)}
              onFinish={() => setShowFinish(true)}
              onAddSet={() => setExtraSets((e) => ({ ...e, [block.id]: (e[block.id] ?? 0) + 1 }))}
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
              bodyweight={bodyweight}
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
                  const pr = prFlags[i]
                  return (
                    <motion.button
                      key={s.id}
                      type="button"
                      className="row"
                      onClick={() => setEditingId(s.id)}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 34 }}
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
                          {s.weight > 0
                            ? `${num(s.weight, 1)} ${profile.units} × ${s.reps}`
                            : `${s.reps} reps`}
                          {s.rpe != null && <span className="dim"> @ RPE {num(s.rpe, 1)}</span>}
                        </span>
                        <span className="row-sub">
                          Set {i + 1}
                          {target && ` · target ${describeReps(target)}${target.rpe ? ` @ ${formatRpe(target.rpe)}` : ''}`}
                          {isEstimable(s) && ` · e1RM ${num(e1RM(s.weight, s.reps, s.rpe), 0)}`}
                        </span>
                      </span>
                      {pr && <Pill tone="warn" icon="seal.fill">PR</Pill>}
                      <Icon name="pencil" size={15} color="var(--label-3)" weight={2} />
                    </motion.button>
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
      <NoteSheet
        open={showNote}
        onClose={() => setShowNote(false)}
        exerciseName={exercise?.name ?? exerciseId}
        value={active.notes[block.id] ?? ''}
        onSave={(text) => setBlockNote(block.id, text)}
      />

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
        onClose={() => setEditingId(null)}
        onDelete={(id) => {
          removeLoggedSet(block.id, id)
          setEditingId(null)
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
        tonnage={sessionVolume}
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
        open={!!conflict}
        title="A workout is already in progress"
        message={
          conflict
            ? `${
                findSession(program, conflict.weekIndex, conflict.sessionId)?.session.name ?? 'A session'
              } has ${Object.values(conflict.entries).reduce((n, x) => n + x.length, 0)} sets logged. Finish or discard it before starting another.`
            : undefined
        }
        onDismiss={() => {
          setConflict(null)
          dismiss()
        }}
        actions={[
          {
            label: 'Back to it',
            strong: true,
            onPress: () => {
              const target = conflict!
              setConflict(null)
              present('runner', { weekIndex: target.weekIndex, sessionId: target.sessionId })
            },
          },
          {
            label: 'Discard and start',
            destructive: true,
            onPress: () => {
              discardSession()
              startSession(weekIndex, sessionId)
              setConflict(null)
            },
          },
        ]}
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
              toast('Workout discarded', { icon: 'trash', tone: 'bad' })
            },
          },
        ]}
      />
    </div>
  )

  function nameOf(b: (typeof session.blocks)[number]) {
    const ex = getExercise(active!.swaps[b.id] ?? b.exerciseId)
    return ex?.shortName ?? ex?.name ?? b.exerciseId
  }

  function logRawSet(set: SetPrescription, weight: number, reps: number, rpe?: number) {
    logSet(block.id, { prescriptionId: set.id, weight, reps, rpe })
    const est = e1RM(weight, reps, rpe)
    if (est > runningBest + 0.01 && historicalBest > 0) {
      haptic('heavy')
      toast(`New best — ${num(est, 0)} ${profile.units} estimated max`, {
        icon: 'seal.fill',
        tone: 'good',
      })
    } else {
      haptic('success')
    }
    if (settings.restTimerAuto) {
      const rest = set.restSec ?? exercise?.defaultRestSec ?? 120
      // Rest is dead time the client spends waiting for the *next* set, so the
      // timer names that rather than the one they have just finished. It is the
      // only thing on screen when the runner is minimised.
      const done = logged.length + 1
      const nextBlock = session.blocks[blockIndex + 1]
      const label =
        done < allowedSets
          ? `Next · ${exercise?.shortName ?? exercise?.name ?? 'set'} ${done + 1}`
          : nextBlock
            ? `Next · ${nameOf(nextBlock)}`
            : `${session.name} — last set done`
      startRest(rest, label)
    }
  }
}

/**
 * Chromium drops smooth scrolling when the system asks for reduced motion, but
 * not every engine does, so the preference is read rather than assumed.
 */
function scrollBehaviour(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

/** A load of zero is a bodyweight lift's placeholder, never a target. */
function loaded(weight?: number) {
  return weight != null && weight > 0 ? weight : undefined
}

/* ---------------------------------- logger ------------------------------- */

function SetLogger({
  prescription, blockSets, resolved, units, increment, showRir, bodyweight, lastSet, previous, onLog,
}: {
  prescription: SetPrescription
  /** Every prescription in this block, so feedback can find the last set's own target. */
  blockSets: SetPrescription[]
  resolved: ReturnType<typeof resolveSet>
  units: string
  increment: number
  showRir: boolean
  /** No load to hit, so the weight field is asking for anything *added*. */
  bodyweight: boolean
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
    // load is set by the working max, so the deviation is information for the
    // coach rather than a number to override.
    const autoregulated = prescription.load.kind === 'rpe'
    return { ...result, autoregulated }
  }, [lastSet, blockSets, increment, prescription.load.kind])

  const plateSteps = increment >= 5 ? [-10, -5, 5, 10] : [-5, -2.5, 2.5, 5]

  // "Off target" is what earns the amber reading, so a rep range has to count
  // its whole range as on target and an AMRAP can only ever be short, never
  // over. RPE is a judgement call, so only a whole point out is a deviation.
  const repsOff =
    reps < prescription.reps
    || (!prescription.amrap && reps > (prescription.repsMax ?? prescription.reps))
  const rpeOff = rpe != null && prescription.rpe != null && Math.abs(rpe - prescription.rpe) >= 1

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

      <div className="card" style={{ margin: 0, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Quantity
            label={bodyweight ? `Added (${units})` : `Weight (${units})`}
            value={num(weight, 1)}
            onPress={() => setPad('weight')}
            onStep={(d) => setWeight((w) => Math.max(0, Math.round((w + d) * 100) / 100))}
            step={increment}
            stepLabel={num(increment, 2)}
            atMin={weight <= 0}
            off={resolved.targetWeight != null && weight !== resolved.targetWeight}
          />
          <Quantity
            label="Reps"
            value={String(reps)}
            onPress={() => setPad('reps')}
            onStep={(d) => setReps((r) => Math.max(1, Math.min(100, r + d)))}
            step={1}
            atMin={reps <= 1}
            atMax={reps >= 100}
            off={repsOff}
          />
          <Quantity
            label={showRir ? 'RPE / RIR' : 'RPE'}
            value={rpe != null ? (showRir ? `${num(rpe, 1)} / ${num(rpeToRir(rpe), 1)}` : num(rpe, 1)) : '—'}
            onPress={() => setRpeSheet(true)}
            onStep={(d) => setRpe((v) => clampRpe((v ?? prescription.rpe ?? 8) + d))}
            step={0.5}
            stepLabel="0.5"
            atMin={rpe != null && rpe <= MIN_RPE}
            atMax={rpe != null && rpe >= MAX_RPE}
            off={rpeOff}
          />
        </div>

        <div style={{ marginTop: 11 }}>
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
          <div className="t-caption1 dim mono-nums" style={{ textAlign: 'center', marginTop: 8 }}>
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
              {showRir && ` — ${formatRir(rpeToRir(prescription.rpe))} in reserve`}.
            </div>
          )}
        </div>
      </Sheet>
    </div>
  )
}

/**
 * One number the client is about to log. The reading opens a precise editor;
 * the footer nudges it by a step, because a set that came up one rep short is
 * the commonest edit there is and it used to cost a sheet, a keypad and a Done.
 * Press and hold ramps, as UIKit's stepper does, so a two-plate change is one
 * gesture rather than four taps.
 */
function Quantity({
  label, value, onPress, onStep, step, stepLabel, atMin, atMax, off,
}: {
  label: string
  value: string
  onPress: () => void
  onStep: (delta: number) => void
  step: number
  /** How much a tap moves, drawn on the buttons. Defaults to the step itself. */
  stepLabel?: string
  atMin?: boolean
  atMax?: boolean
  /** The value no longer matches what Jud asked for — worth seeing at a glance. */
  off?: boolean
}) {
  const repeat = useRef<number | null>(null)
  const stop = () => {
    if (repeat.current) window.clearTimeout(repeat.current)
    repeat.current = null
  }
  useEffect(() => stop, [])

  const start = (delta: number) => {
    let speed = 400
    const tick = () => {
      haptic('selection')
      onStep(delta)
      speed = Math.max(70, speed * 0.8)
      repeat.current = window.setTimeout(tick, speed)
    }
    repeat.current = window.setTimeout(tick, 460)
  }

  const amount = stepLabel ?? num(step, 2)
  const button = (delta: number, disabled?: boolean) => (
    <button
      type="button"
      className="runner-step hit-expand mono-nums"
      aria-label={`${delta < 0 ? 'Decrease' : 'Increase'} ${label} by ${amount}`}
      disabled={disabled}
      onClick={() => {
        haptic('selection')
        onStep(delta)
      }}
      onPointerDown={() => !disabled && start(delta)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{ fontSize: 15, fontWeight: 600 }}
    >
      {delta < 0 ? '−' : '+'}{amount}
    </button>
  )

  return (
    <div className="runner-quant">
      <button type="button" className="runner-quant-read" onClick={onPress}>
        <div
          className="t-caption2 dim semibold truncate"
          style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}
        >
          {label}
        </div>
        <div
          className="mono-nums truncate"
          style={{
            fontSize: 22,
            lineHeight: '26px',
            fontWeight: 700,
            letterSpacing: -0.5,
            color: off ? 'var(--orange-text)' : undefined,
          }}
        >
          {value}
        </div>
      </button>
      <div className="runner-quant-steps">
        {button(-step, atMin)}
        <span className="runner-step-sep" />
        {button(step, atMax)}
      </div>
    </div>
  )
}

const clampRpe = (v: number) => Math.min(MAX_RPE, Math.max(MIN_RPE, Math.round(v * 2) / 2))

/* ------------------------------ block complete --------------------------- */

function BlockCompleteCard({
  logged, units, sessionName, nextExercise, sessionComplete, elapsed, sessionSets, sessionVolume,
  onNext, onFinish, onAddSet,
}: {
  logged: LoggedSet[]
  units: string
  sessionName: string
  /** Undefined on the last block of the session. */
  nextExercise?: string
  /** Every prescribed set in the session is logged — this is the end of it. */
  sessionComplete: boolean
  elapsed: number
  sessionSets: number
  sessionVolume: number
  onNext: () => void
  onFinish: () => void
  onAddSet: () => void
}) {
  const best = logged.reduce((b, s) => (s.weight > b.weight ? s : b), logged[0]!)
  const tonnage = sessionTonnage(logged)
  // Built as a list so a bodyweight block, which moves no tonnage at all, drops
  // the clause instead of trailing an orphaned separator.
  const stats = sessionComplete
    ? [
        `${sessionSets} sets`,
        formatDuration(elapsed),
        sessionVolume > 0 ? `${num(sessionVolume, 0)} ${units} moved` : null,
      ]
    : [
        `${logged.length} sets`,
        best.weight > 0 ? `top ${num(best.weight, 1)} ${units} × ${best.reps}` : `top ${best.reps} reps`,
        tonnage > 0 ? `${num(tonnage, 0)} ${units} moved` : null,
      ]
  return (
    <div className="gutter">
      <div
        className="card"
        style={{
          margin: 0,
          padding: 16,
          textAlign: 'center',
          // The end of the session gets the same green border the target card
          // gets in accent: it is the one card on screen that means "stop".
          border: sessionComplete ? '1.5px solid var(--green)' : undefined,
        }}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          style={{
            width: sessionComplete ? 62 : 52, height: sessionComplete ? 62 : 52,
            borderRadius: '50%', margin: '0 auto 10px',
            background: 'rgba(52,199,89,0.16)', display: 'grid', placeItems: 'center',
          }}
        >
          <Icon name="check" size={sessionComplete ? 34 : 28} weight={3} color="var(--green)" />
        </motion.div>
        <div className={sessionComplete ? 't-title2' : 't-headline'}>
          {sessionComplete ? `${sessionName} done` : 'All sets logged'}
        </div>
        <div className="t-footnote dim mono-nums" style={{ marginTop: 3 }}>
          {stats.filter(Boolean).join(' · ')}
        </div>
        {sessionComplete ? (
          <>
            <div style={{ marginTop: 14 }}>
              <Button icon="check.circle.fill" onPress={onFinish} style={{ minHeight: 52, fontSize: 18 }}>
                Finish workout
              </Button>
            </div>
            <button
              type="button"
              className="t-footnote"
              onClick={onAddSet}
              style={{ color: 'var(--accent)', marginTop: 4, padding: '13px 16px' }}
            >
              Not done — add another set
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <Button variant="gray" onPress={onAddSet} style={{ flex: 1, minHeight: 44 }} small>
              <Icon name="plus" size={15} weight={2.4} />
              Extra set
            </Button>
            {nextExercise ? (
              <Button onPress={onNext} style={{ flex: 1.4, minWidth: 0, minHeight: 44 }} small>
                <span className="truncate">{nextExercise}</span>
                <Icon name="chevron.right" size={15} weight={2.4} />
              </Button>
            ) : (
              <Button onPress={onFinish} style={{ flex: 1.4, minHeight: 44 }} small>
                Finish workout
              </Button>
            )}
          </div>
        )}
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

        <div style={{ marginBottom: 14 }}>
          <SearchField value={query} onChange={setQuery} placeholder="Search all exercises" />
        </div>

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
            <Quantity
              label={`Weight (${units})`}
              value={num(set.weight, 1)}
              onPress={() => setPad('weight')}
              onStep={(d) =>
                updateLoggedSet(prescriptionId, set.id, {
                  weight: Math.max(0, Math.round((set.weight + d) * 100) / 100),
                })
              }
              step={increment}
              stepLabel={num(increment, 2)}
              atMin={set.weight <= 0}
            />
            <Quantity
              label="Reps"
              value={String(set.reps)}
              onPress={() => setPad('reps')}
              onStep={(d) =>
                updateLoggedSet(prescriptionId, set.id, {
                  reps: Math.max(1, Math.min(100, set.reps + d)),
                })
              }
              step={1}
              atMin={set.reps <= 1}
              atMax={set.reps >= 100}
            />
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

/* -------------------------------- note sheet ----------------------------- */

function NoteSheet({
  open, onClose, exerciseName, value, onSave,
}: {
  open: boolean
  onClose: () => void
  exerciseName: string
  value: string
  onSave: (text: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Note"
      left={{ label: 'Cancel', onPress: onClose }}
      right={{
        label: 'Save',
        strong: true,
        onPress: () => {
          onSave(draft.trim())
          onClose()
        },
      }}
      detent={0.6}
    >
      <div style={{ padding: '8px 16px 16px' }}>
        <div className="t-footnote dim" style={{ marginBottom: 10 }}>
          Anything about {exerciseName} that Jud should see with this session — a pinch, a cue that
          clicked, a machine that was set differently.
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Left knee felt off on the first set…"
          style={{
            width: '100%', padding: '11px 13px', borderRadius: 12, border: 'none',
            background: 'var(--fill-3)', resize: 'none', lineHeight: '22px',
          }}
        />
      </div>
    </Sheet>
  )
}
