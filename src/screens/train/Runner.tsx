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
  resolveSet, rpeToRir, sessionTonnage, snapRpe, suggestNextLoad, topSet,
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
  // The best just beaten, kept against its block so it stays up for the rest of
  // the exercise rather than for the three seconds a toast lasts.
  const [pr, setPr] = useState<{ blockId: string; est: number; previous: number } | null>(null)
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
  const sessionSets = Object.values(active.entries).flat()
  const avgRpe = averageRpe(sessionSets)

  // The session's plan, one cell per prescribed set, with the effort painted on
  // as the sets land. An extra set past the prescription adds a cell rather than
  // going unrecorded, and the exercise boundaries are kept so the strip reads as
  // the session's shape rather than as one long bar.
  const trace = session.blocks.flatMap((b, i) => {
    const sets = active.entries[b.id] ?? []
    return Array.from({ length: Math.max(b.sets.length, sets.length) }, (_, j) => ({
      key: `${b.id}-${j}`,
      rpe: sets[j]?.rpe,
      done: j < sets.length,
      blockStart: j === 0 && i > 0,
    }))
  })

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
  // Where the number on the card came from. One slot, always in the same place,
  // because it always answers the same question — and a set worked up to by feel
  // has to say so, or the history it borrows reads as an instruction.
  const loadKind =
    prescription.load.kind === 'percent' ? `${num(prescription.load.value, 1)}% of TM`
    : prescription.load.kind === 'backoff' ? `${prescription.load.pctOfTop}% of top set`
    : prescription.load.kind === 'bodyweight' ? 'Bodyweight'
    : prescription.load.kind === 'rpe' && resolved.targetWeight == null
      ? anchorWeight != null ? 'Work up · last time' : 'Work up by feel'
      : undefined

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
            <div className="data" style={{ fontSize: 17, lineHeight: '19px', fontWeight: 700 }}>
              {formatDuration(elapsed)}
            </div>
          </div>
          <div className="navbar-side right">
            <button className="nav-btn strong" type="button" onClick={() => setShowFinish(true)}>
              Finish
            </button>
          </div>
        </div>

        <div style={{ padding: '0 var(--gutter) 6px' }}>
          <div
            className="runner-trace"
            role="img"
            aria-label={`${doneSets} of ${totalSets} sets logged`}
          >
            {trace.map((cell) => (
              <span
                key={cell.key}
                className="runner-trace-cell"
                data-rpe={cell.rpe ?? ''}
                data-done={cell.done || undefined}
                data-block-start={cell.blockStart || undefined}
              />
            ))}
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
                  borderRadius: 'var(--r-pill)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: -0.1,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: current
                    ? 'var(--accent)'
                    : complete ? 'color-mix(in srgb, var(--green) 16%, transparent)' : 'var(--fill-3)',
                  // systemGreen is a fill and a symbol colour, never a text one:
                  // it is 2.2:1 on white. The darker twin is what iOS sets type
                  // in, and on a dark ground the two converge anyway.
                  color: current ? '#fff' : complete ? 'var(--green-text)' : 'var(--label-2)',
                }}
              >
                {complete && <Icon name="check" size={11} weight={3} />}
                {ex?.shortName ?? ex?.name ?? '—'}
                <span className="data" style={{ opacity: 0.65, fontSize: 12 }}>
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
                  // A destination, not the action of the screen: a row with a
                  // chevron. The accent belongs to Log set.
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    marginTop: 10, padding: '10px 11px', borderRadius: 'var(--r-inset)',
                    background: 'var(--fill-4)', textAlign: 'left',
                  }}
                >
                  <Icon name="swap" size={14} weight={2.4} color="var(--label-2)" />
                  <span className="t-footnote truncate" style={{ flex: 1, minWidth: 0 }}>
                    <span className="eyebrow">Superset {block.supersetGroup}</span>
                    {partnerEx ? ` · alternate with ${partnerEx.shortName ?? partnerEx.name}` : ''}
                  </span>
                  {partnerIndex >= 0 && (
                    <Icon name="chevron.right" size={13} weight={2.6} color="var(--label-3)" />
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
                  marginTop: 10, padding: '9px 11px', borderRadius: 'var(--r-inset)',
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
                className="card runner-target"
                style={{ margin: 0, background: 'var(--grouped-2)' }}
              >
                <div className="runner-target-head">
                  <span className="eyebrow">
                    Set {setIndex + 1} of {block.sets.length} · Target
                  </span>
                  {loadKind && <span className="eyebrow runner-target-kind">{loadKind}</span>}
                </div>
                <div className="runner-target-line">
                  <span
                    className="figure runner-figure"
                    // An autoregulated lift has no prescribed load, so the anchor
                    // comes from history and is shown as a reference rather than
                    // as an instruction.
                    data-reference={
                      !bodyweight && resolved.targetWeight == null && anchorWeight != null
                        ? 'true'
                        : undefined
                    }
                  >
                    {bodyweight
                      ? describeReps(prescription)
                      : resolved.targetWeight != null
                        ? num(resolved.targetWeight, 1)
                        : anchorWeight != null
                          ? num(anchorWeight, 1)
                          : '—'}
                  </span>
                  <span className="figure-unit runner-figure-unit">
                    {bodyweight ? 'reps' : profile.units}
                  </span>
                  {!bodyweight && (
                    <span className="data runner-figure-reps">×{describeReps(prescription)}</span>
                  )}
                  {prescription.rpe != null && <RpeTag rpe={prescription.rpe} kind="target" />}
                </div>

                {(prescription.amrap || prescription.tempo || swapped) && (
                  <div className="runner-target-pills">
                    {prescription.amrap && <Pill tone="warn" icon="flame.fill">AMRAP</Pill>}
                    {prescription.tempo && <Pill>Tempo {prescription.tempo}</Pill>}
                    {swapped && (
                      <Pill tone="warn">
                        Carried from {getExercise(block.exerciseId)?.shortName
                          ?? getExercise(block.exerciseId)?.name}
                      </Pill>
                    )}
                  </div>
                )}

                {settings.showPlateMath && exercise?.barLoaded && resolved.targetWeight != null && (
                  <div className="runner-target-rule">
                    <Barbell target={resolved.targetWeight} profile={profile} height={56} />
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

          {/* -------------------------------- a best -------------------------- */}
          {pr?.blockId === block.id && (
            <div className="gutter">
              <PrBanner est={pr.est} previous={pr.previous} units={profile.units} />
            </div>
          )}

          {/* ------------------------------ logger ---------------------------- */}
          {isBlockDone ? (
            <BlockCompleteCard
              logged={logged}
              units={profile.units}
              exerciseName={exercise?.shortName ?? exercise?.name ?? exerciseId}
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
              avgRpe={avgRpe}
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
              <div className="eyebrow" style={{ marginBottom: 7 }}>Logged this exercise</div>
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
                      data-rpe={s.rpe ?? ''}
                      style={{ ['--row-sep-inset' as string]: '16px' }}
                    >
                      <span className="runner-set-index data">{i + 1}</span>
                      <span className="row-body">
                        <span className="row-title data">
                          {s.weight > 0 ? (
                            <>
                              {num(s.weight, 1)}
                              <span className="dim"> {profile.units} × </span>
                              {s.reps}
                            </>
                          ) : (
                            <>
                              {s.reps}
                              <span className="dim"> reps</span>
                            </>
                          )}
                          {s.rpe != null && <span className="runner-set-rpe"> @{num(s.rpe, 1)}</span>}
                        </span>
                        <span className="row-sub truncate">
                          {target
                            ? `Target ${describeReps(target)}${target.rpe ? ` @ ${formatRpe(target.rpe)}` : ''}`
                            : 'Extra set'}
                          {isEstimable(s) && ` · e1RM ${num(e1RM(s.weight, s.reps, s.rpe), 0)}`}
                        </span>
                      </span>
                      {pr && (
                        <span className="runner-set-pr">
                          <Icon name="seal.fill" size={10} />
                          Best
                        </span>
                      )}
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
              <div className="eyebrow" style={{ marginBottom: 6 }}>Cues</div>
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

          {/* ----------------------------- nav feet ---------------------------
              A finished block already carries the way on, and the way on cannot
              be two accent buttons on one screen. An ending is not an ending
              with a pair of grey buttons under it either. */}
          {!isBlockDone && (
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
          )}

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
    // The same bar every logged set is held to on the way in — a twelve-rep set
    // at RPE 8 used to clear `historicalBest`, which is built from near-maximal
    // work only, and announce a best the list below then refused to badge.
    const candidate: LoggedSet = { id: '', prescriptionId: set.id, weight, reps, rpe, completedAt: '' }
    const est = isMaxEffort(candidate) ? e1RM(weight, reps, rpe) : 0
    if (est > runningBest + 0.01 && historicalBest > 0) {
      haptic('heavy')
      setPr({ blockId: block.id, est, previous: runningBest })
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

/** Mean effort across a group of sets, ignoring any that were never rated. */
function averageRpe(sets: LoggedSet[]): number | undefined {
  const rated = sets.filter((s) => !s.warmup && s.rpe != null)
  if (rated.length === 0) return undefined
  return rated.reduce((n, s) => n + s.rpe!, 0) / rated.length
}

/**
 * Thousands separated. Only the two figures large enough to need it use this —
 * a session's tonnage and a block's — where an ungrouped five digits at 46px is
 * a number nobody can read at arm's length.
 */
function grouped(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/**
 * Intensity as a tag. What Jud asked for is an outline the set has to land
 * inside; what the bar actually felt like is filled in. Both take the ramp, so
 * a target and the effort that met it can be compared by colour alone.
 */
function RpeTag({
  rpe, label, kind,
}: {
  rpe: number
  /** Shown instead of the RPE itself, for an average that falls between steps. */
  label?: string
  kind?: 'target'
}) {
  // No RIR here even when the client reads in RIR. It is the same number said
  // backwards, it doubles the tag's width, and the control they are about to
  // touch prints both — on a rep-range set the pair pushed the target on to a
  // second line.
  return (
    <span className="rpe-tag" data-rpe={rpe} data-kind={kind}>
      <span className="rpe-tag-label">RPE</span>
      <span className="rpe-tag-value">{label ?? num(rpe, 1)}</span>
    </span>
  )
}

/**
 * A best, beaten. This used to be a toast that was gone before the bar was
 * racked; it now stays up for the rest of the exercise and says by how much,
 * which is the part a lifter actually wants.
 */
function PrBanner({ est, previous, units }: { est: number; previous: number; units: string }) {
  return (
    <motion.div
      className="runner-pr"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
    >
      <Icon name="seal.fill" size={22} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow" style={{ color: 'inherit' }}>New best</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
          <span className="figure runner-pr-figure">{num(est, 0)}</span>
          <span className="figure-unit runner-pr-unit">{units} e1RM</span>
          <span className="data runner-pr-delta">
            +{num(est - previous, 0)} on {num(previous, 0)}
          </span>
        </div>
      </div>
    </motion.div>
  )
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
  // over. Effort needs no equivalent: the RPE reading is drawn in the ramp, so a
  // set that came in a point hot is a different colour from the card above it.
  const repsOff =
    reps < prescription.reps
    || (!prescription.amrap && reps > (prescription.repsMax ?? prescription.reps))

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
              borderRadius: 'var(--r-card)',
              background: feedback.direction === 'up'
                ? 'color-mix(in srgb, var(--green) 13%, transparent)'
                : 'color-mix(in srgb, var(--orange) 13%, transparent)',
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
              <div className="t-caption1 dim">
                {feedback.autoregulated ? (
                  <>
                    Suggested <span className="data">{num(feedback.suggestedWeight, 1)} {units}</span>
                  </>
                ) : (
                  'Logged for Jud — the next set keeps its prescribed percentage.'
                )}
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
            // Effort has a colour of its own everywhere else in the app, so it
            // keeps it here: dialling past the target turns the reading orange
            // against the target card's ring, which says the same thing the
            // amber "off" state would have and says it in the ramp's language.
            rpe={rpe}
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 9 }}>
            <span className="eyebrow">e1RM</span>
            <span className="data" style={{ fontSize: 14 }}>
              {num(e1RM(weight, reps, rpe), 0)}
              <span className="dim" style={{ fontWeight: 500 }}> {units}</span>
            </span>
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
  label, value, onPress, onStep, step, stepLabel, atMin, atMax, off, rpe,
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
  /** This control *is* an effort, so its reading takes the intensity ramp. */
  rpe?: number
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
      className="runner-step hit-expand data"
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
    <div className="runner-quant" data-rpe={rpe ?? undefined}>
      <button type="button" className="runner-quant-read" onClick={onPress}>
        <div className="eyebrow truncate">{label}</div>
        <div
          className="data truncate"
          style={{
            fontSize: 23,
            lineHeight: '27px',
            fontWeight: 700,
            color: rpe != null ? 'var(--rpe)' : off ? 'var(--orange-text)' : undefined,
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
  logged, units, exerciseName, sessionName, nextExercise, sessionComplete, elapsed, sessionSets,
  sessionVolume, avgRpe, onNext, onFinish, onAddSet,
}: {
  logged: LoggedSet[]
  units: string
  exerciseName: string
  sessionName: string
  /** Undefined on the last block of the session. */
  nextExercise?: string
  /** Every prescribed set in the session is logged — this is the end of it. */
  sessionComplete: boolean
  elapsed: number
  sessionSets: number
  sessionVolume: number
  /** Mean RPE across every logged set, undefined when nothing was rated. */
  avgRpe?: number
  onNext: () => void
  onFinish: () => void
  onAddSet: () => void
}) {
  const best = logged.reduce((b, s) => (s.weight > b.weight ? s : b), logged[0]!)
  const tonnage = sessionTonnage(logged)
  const blockRpe = averageRpe(logged)

  if (sessionComplete) {
    // The number that says what the hour was worth. A session of bodyweight work
    // moves no tonnage at all, so the count of sets takes the hero's place
    // rather than leaving a nought at 46px.
    const hero = sessionVolume > 0
      ? { value: grouped(sessionVolume), unit: units, caption: 'Total moved' }
      : { value: String(sessionSets), unit: '', caption: sessionSets === 1 ? 'Set done' : 'Sets done' }

    return (
      <div className="gutter">
        <motion.div
          className="card runner-done"
          style={{ margin: 0 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          <motion.div
            className="runner-done-mark"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.08 }}
          >
            <Icon name="check" size={26} weight={3} color="var(--green)" />
          </motion.div>
          <div className="eyebrow" style={{ textAlign: 'center', color: 'var(--green-text)' }}>
            Session complete
          </div>
          <div className="t-title2" style={{ textAlign: 'center', marginTop: 2 }}>{sessionName}</div>

          <div className="runner-done-total">
            <span className="figure runner-done-figure">{hero.value}</span>
            {hero.unit && <span className="figure-unit runner-done-unit">{hero.unit}</span>}
          </div>
          <div className="eyebrow" style={{ textAlign: 'center', marginTop: 4 }}>{hero.caption}</div>

          <div className="runner-done-stats">
            <DoneStat label="Time" value={formatDuration(elapsed)} />
            {sessionVolume > 0 && <DoneStat label="Sets" value={String(sessionSets)} />}
            {avgRpe != null && (
              <DoneStat label="Avg effort" value={num(avgRpe, 1)} rpe={snapRpe(avgRpe)} />
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <Button icon="check.circle.fill" onPress={onFinish} style={{ minHeight: 52, fontSize: 18 }}>
              Finish workout
            </Button>
          </div>
          <button
            type="button"
            className="t-footnote"
            onClick={onAddSet}
            style={{
              display: 'block', width: '100%', color: 'var(--accent)',
              marginTop: 2, padding: '13px 16px',
            }}
          >
            Not done — add another set
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="gutter">
      <div className="card" style={{ margin: 0, padding: '12px 15px 13px' }}>
        <div className="runner-block-done">
          <span className="runner-block-mark">
            <Icon name="check" size={14} weight={3} color="var(--green)" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="eyebrow" style={{ display: 'block' }}>{exerciseName} done</span>
            <span className="data truncate" style={{ display: 'block', fontSize: 16, marginTop: 2 }}>
              {logged.length} sets
              <span className="dim"> · top </span>
              {best.weight > 0 ? `${num(best.weight, 1)} × ${best.reps}` : `${best.reps} reps`}
              {tonnage > 0 && (
                <>
                  <span className="dim"> · </span>
                  {grouped(tonnage)}
                  <span className="dim"> {units}</span>
                </>
              )}
            </span>
          </span>
          {blockRpe != null && <RpeTag rpe={snapRpe(blockRpe)} label={num(blockRpe, 1)} />}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
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
      </div>
    </div>
  )
}

function DoneStat({ label, value, rpe }: { label: string; value: string; rpe?: number }) {
  return (
    <div className="runner-done-stat">
      <div className="data runner-done-stat-value" data-rpe={rpe ?? undefined}>{value}</div>
      <div className="eyebrow truncate" style={{ marginTop: 2 }}>{label}</div>
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
              style={{ borderRadius: 'var(--r-inset)', marginBottom: 2 }}
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
            <div className="eyebrow" style={{ marginBottom: 8 }}>How hard was it?</div>
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
          <SummaryTile label="Time" value={formatDuration(elapsed)} />
          <SummaryTile label="Sets" value={String(doneSets)} />
          <SummaryTile label={`Volume · ${units}`} value={grouped(tonnage)} />
        </div>

        {doneSets < totalSets && (
          <div
            className="t-footnote"
            style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 18,
              background: 'color-mix(in srgb, var(--orange) 13%, transparent)',
              color: 'var(--orange-text)',
            }}
          >
            {totalSets - doneSets} prescribed sets are still unlogged. Jud will see this session as partial.
          </div>
        )}

        <div className="eyebrow" style={{ marginBottom: 8 }}>How hard was the whole session?</div>
        <RpePicker value={sessionRpe} onChange={setSessionRpe} showRir={false} />

        <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Notes for Jud</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Bar speed, aches, sleep, anything that changed how today felt…"
          style={{
            width: '100%',
            padding: '11px 13px',
            borderRadius: 'var(--r-card)',
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
    <div style={{
      background: 'var(--fill-4)', borderRadius: 'var(--r-card)',
      padding: '10px 10px 11px', textAlign: 'center',
    }}>
      <div className="eyebrow truncate">{label}</div>
      <div className="data" style={{ fontSize: 21, lineHeight: '24px', fontWeight: 700, marginTop: 2 }}>
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
            width: '100%', padding: '11px 13px', borderRadius: 'var(--r-card)', border: 'none',
            background: 'var(--fill-3)', resize: 'none', lineHeight: '22px',
          }}
        />
      </div>
    </Sheet>
  )
}
