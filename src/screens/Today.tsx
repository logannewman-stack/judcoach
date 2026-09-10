import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../components/ios/Screen'
import { Card, CoachNote, SectionHeader, StatTile } from '../components/Bits'
import { Icon } from '../components/Icon'
import { Pill } from '../components/ios/Controls'
import { RingStack, MACRO_COLORS } from '../components/Rings'
import { Sparkline } from '../components/Charts'
import { useStore, emptyDay } from '../store/useStore'
import { useCoach } from '../store/coach'
import { CoachCard } from '../components/CoachCard'
import {
  blockSummary, currentWeekIndex, getWeek, isBlockComplete, missedSessions, nextSession,
  sessionsThisWeek, trainingStreak, useProgram, weekSchedule,
} from '../store/selectors'
import { MEAL_PLAN } from '../data/mealPlan'
import { useDayMode } from './meals/dayMode'
import type { ExercisePrescription, Profile, Units, WorkoutLog } from '../domain/types'
import { getExercise } from '../data/exercises'
import { consumedTotals } from '../domain/nutrition'
import { describeReps, formatRpe, resolveSet } from '../domain/strength'
import { rateVerdict, rollingSeries, summarizeTrend, weighInsInLast } from '../domain/weight'
import { formatLongDate, relativeDay, timeOfDayGreeting, todayISO, addDays } from '../lib/date'
import { compact, fixed, num, signed } from '../lib/format'
import { navPresent, navPush, navSwitchTab, useNav } from '../nav/nav'
import { NumberPad } from '../components/NumberPad'
import { toast } from '../components/ios/Toast'

export function TodayScreen() {
  const coachSeat = useCoach((s) => s.viewAs === 'coach')
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const weighIns = useStore((s) => s.weighIns)
  const nutrition = useStore((s) => s.nutrition)
  const active = useStore((s) => s.active)
  const push = useNav((s) => s.push)
  const saveWeighIn = useStore((s) => s.saveWeighIn)
  const [loggingWeight, setLoggingWeight] = useState(false)

  const weekIndex = currentWeekIndex(program, today)
  const week = getWeek(program, weekIndex)
  const next = useMemo(() => nextSession(program, logs, today), [program, logs, today])
  const blockStartedOn = useStore((s) => s.blockStartedOn)
  const missed = useMemo(
    () => missedSessions(program, logs, today, blockStartedOn),
    [program, logs, today, blockStartedOn],
  )
  const weekProgress = sessionsThisWeek(program, logs, today)
  const blockDone = isBlockComplete(program, today)
  const startNextBlock = useStore((s) => s.startNextBlock)
  const streak = trainingStreak(program, logs, today)

  const day = nutrition[today] ?? emptyDay(today)
  // The rest-day flag has to reach the totals as well as the targets: the plan
  // serves smaller portions on a rest day, so counting training-day portions
  // against a rest-day target puts a client 330 kcal in the red for eating
  // exactly what the plan told them to.
  const restDay = useDayMode(today) === 'rest'
  const totals = consumedTotals(MEAL_PLAN, day, restDay)
  const targets = restDay && MEAL_PLAN.restDayTargets ? MEAL_PLAN.restDayTargets : MEAL_PLAN.targets
  const over = totals.kcal - targets.kcal

  const trend = useMemo(() => summarizeTrend(weighIns, 28), [weighIns])
  const series = useMemo(() => rollingSeries(weighIns, 7).slice(-21), [weighIns])
  const weighDays = weighInsInLast(weighIns, today, 7)
  const loggedToday = weighIns.some((w) => w.date === today)

  const todaysLog = logs.find((l) => l.date === today)
  const isRestDay = next?.date !== today && !todaysLog

  return (
    <Screen
      title="Today"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim">{formatLongDate(today)}</div>
        </div>
      }
      right={{ icon: 'person', onPress: () => push('coach'), ariaLabel: 'Your coach' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ------------------------------ hero ----------------------------- */}
        <div>
          <div className="gutter" style={{ marginBottom: 10 }}>
            <div className="t-footnote dim semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {timeOfDayGreeting()}, {profile.name.split(' ')[0]}
            </div>
          </div>
          {blockDone ? (
            <BlockCompleteCard
              program={program}
              logs={logs}
              units={profile.units}
              onStart={() => {
                startNextBlock()
                toast('New block started', { icon: 'check.circle.fill', tone: 'good' })
              }}
            />
          ) : active ? (
            <ResumeCard />
          ) : todaysLog ? (
            <CompletedCard name={todaysLog.sessionName} onPress={() => push('logDetail', { logId: todaysLog.id })} />
          ) : next ? (
            <NextSessionCard
              date={next.date}
              today={today}
              name={next.session.name}
              focus={next.session.focus}
              minutes={next.session.estMinutes}
              exercises={next.session.blocks.length}
              mainLift={mainLiftSummary(next.session.blocks[0], profile)}
              weekLabel={next.week.label}
              deload={next.week.deload}
              onStart={() => navPresent('runner', { weekIndex: next.week.index, sessionId: next.session.id })}
              onPreview={() => push('session', { weekIndex: next.week.index, sessionId: next.session.id })}
              isRestDay={isRestDay}
            />
          ) : null}
        </div>

        {/* ---------------------------- nutrition -------------------------- */}
        <div>
          {/* A rest day quietly serves different targets and different portions;
              say which plan these numbers came from rather than letting 330 kcal
              move on its own. */}
          <SectionHeader
            title={
              restDay ? (
                <>
                  Fuel <span className="t-subhead dim" style={{ fontWeight: 400 }}>· Rest day</span>
                </>
              ) : (
                'Fuel'
              )
            }
            action={{ label: 'Log meals', onPress: () => navSwitchTab('meals') }}
          />
          <Card onPress={() => navSwitchTab('meals')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <RingStack
                size={104}
                thickness={10}
                gap={3.5}
                rings={[
                  { value: totals.protein, target: targets.protein, color: MACRO_COLORS.protein },
                  { value: totals.carbs, target: targets.carbs, color: MACRO_COLORS.carbs },
                  { value: totals.fat, target: targets.fat, color: MACRO_COLORS.fat },
                ]}
              >
                <div style={{ lineHeight: 1 }}>
                  <div className="mono-nums bold" style={{ fontSize: 19, letterSpacing: -0.4 }}>
                    {Math.round(totals.kcal)}
                  </div>
                  <div className="t-caption2 dim" style={{ marginTop: 2 }}>kcal</div>
                </div>
              </RingStack>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <MacroLine label="Protein" value={totals.protein} target={targets.protein} color={MACRO_COLORS.protein} />
                <MacroLine label="Carbs" value={totals.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} />
                <MacroLine label="Fat" value={totals.fat} target={targets.fat} color={MACRO_COLORS.fat} />
                <div
                  className="t-caption1"
                  style={{ marginTop: 1, color: over > 0 ? 'var(--orange)' : 'var(--label-2)' }}
                >
                  {over > 0
                    ? `${Math.round(over)} kcal over target`
                    : `${Math.round(-over)} kcal left today`}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ------------------------------ weight --------------------------- */}
        <div>
          <SectionHeader
            title="Bodyweight"
            action={{ label: loggedToday ? 'History' : 'Weigh in', onPress: () => navSwitchTab('weigh') }}
          />
          <Card onPress={() => navSwitchTab('weigh')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-footnote dim">7-day average</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="mono-nums" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.7 }}>
                    {trend ? fixed(trend.current, 1) : '—'}
                  </span>
                  <span className="t-callout dim">{profile.units}</span>
                </div>
                {trend && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {trend.reliable ? (
                      <Pill tone={rateTone(trend, profile.weeklyRateTarget)}>
                        {signed(trend.perWeek, 2)} {profile.units}/wk
                      </Pill>
                    ) : (
                      <Pill>Trend builds over a week</Pill>
                    )}
                    <Pill>Goal {num(profile.goalWeight, 0)}</Pill>
                  </div>
                )}
              </div>
              <Sparkline
                values={series.map((p) => p.avg)}
                width={92}
                height={44}
                color={trend && trend.perWeek >= 0 ? 'var(--green)' : 'var(--accent)'}
              />
            </div>
          </Card>
          {!loggedToday && (
            <div className="gutter" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-tinted btn-sm"
                style={{ width: '100%', minHeight: 42 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setLoggingWeight(true)
                }}
              >
                <Icon name="plus" size={15} weight={2.6} />
                Log this morning's weigh-in
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------ this week ------------------------ */}
        <div>
          <SectionHeader title="This week" action={{ label: 'Programme', onPress: () => navSwitchTab('train') }} />
          <div className="gutter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <StatTile
              label="Sessions"
              value={`${weekProgress.done}/${weekProgress.total}`}
              caption={week?.deload ? 'Deload week' : `Week ${weekIndex}`}
              icon="dumbbell"
            />
            <StatTile
              label="Streak"
              value={streak}
              caption={streak === 1 ? 'session' : 'sessions'}
              icon="flame.fill"
              tone={streak >= 3 ? 'var(--orange)' : undefined}
            />
            <StatTile
              label="Weigh-ins"
              value={`${weighDays}/7`}
              caption="this week"
              icon="scale"
              tone={weighDays >= 5 ? 'var(--green)' : undefined}
            />
          </div>
          <div className="gutter" style={{ marginTop: 10 }}>
            <WeekStrip />
          </div>
        </div>

        {/* ----------------------------- coach note ------------------------ */}
        {week && (
          <div className="gutter">
            <CoachNote>{week.emphasis}</CoachNote>
          </div>
        )}

        {/* ------------------------------ missed --------------------------- */}
        {missed.length > 0 && (
          <div>
            <SectionHeader title="Catch up" />
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 10, flex: 'none',
                    background: 'rgba(255,149,0,0.16)', display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon name="clock" size={19} color="var(--orange)" weight={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-headline">
                    {missed.length} missed {missed.length === 1 ? 'session' : 'sessions'}
                  </div>
                  <div className="t-footnote dim truncate">
                    {missed.slice(-2).map((m) => `${m.session.name} · ${relativeDay(m.date, today)}`).join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-tinted btn-sm"
                  onClick={() => navPush('session', { weekIndex: missed[missed.length - 1]!.week.index, sessionId: missed[missed.length - 1]!.session.id })}
                >
                  View
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------- coach --------------------------- */}
        <div>
          <SectionHeader
            title={coachSeat ? 'From your client' : 'From Jud'}
            action={{ label: 'Profile', onPress: () => navPush('coach') }}
          />
          <div className="gutter">
            <CoachCard />
          </div>
        </div>
      </div>

      <NumberPad
        open={loggingWeight}
        onClose={() => setLoggingWeight(false)}
        onSubmit={(w) => {
          saveWeighIn({ date: today, weight: w })
          toast(`${fixed(w, 1)} ${profile.units} logged`, { icon: 'scale', tone: 'good' })
        }}
        title="Today's weight"
        initial={weighIns[weighIns.length - 1]?.weight ?? profile.startWeight}
        unit={profile.units}
        steps={[-1, -0.2, 0.2, 1]}
        hint="First thing, after the bathroom, before food or water."
        submitLabel="Save"
      />
    </Screen>
  )
}

/* ------------------------------ sub-components --------------------------- */

function MacroLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  // Past the target the bar fills and the number turns, so an overshoot reads
  // as an overshoot rather than as a completed goal.
  const over = target > 0 && value > target * 1.02
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="t-caption1 semibold dim">{label}</span>
        <span
          className="t-caption1 mono-nums semibold"
          style={over ? { color: 'var(--orange)' } : undefined}
        >
          {Math.round(value)}
          <span className="dim" style={{ fontWeight: 400 }}>/{Math.round(target)}g</span>
        </span>
      </div>
      <div className="track" style={{ height: 5, marginTop: 3 }}>
        <motion.div
          className="track-fill"
          style={{ background: over ? 'var(--orange)' : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

/** Shown once the block's last week is behind them, so the app doesn't simply
    run out and pin every client on week eight forever. */
function BlockCompleteCard({
  program, logs, units, onStart,
}: {
  program: ReturnType<typeof useProgram>
  logs: WorkoutLog[]
  units: Units
  onStart: () => void
}) {
  const summary = blockSummary(program, logs)
  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: 'linear-gradient(155deg, color-mix(in srgb, var(--green) 88%, #000) 0%, color-mix(in srgb, var(--teal) 82%, #000) 100%)',
        color: '#fff',
      }}
    >
      <div className="t-caption1 semibold" style={{ opacity: 0.86, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Block complete
      </div>
      <div style={{ fontSize: 26, lineHeight: '31px', fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>
        {program.name}
      </div>
      <div className="t-subhead" style={{ opacity: 0.88, marginTop: 3 }}>
        {summary.sessions} of {summary.scheduled} sessions · {summary.sets} working sets ·{' '}
        {compact(summary.tonnage)} {units} moved
      </div>
      <button
        type="button"
        className="btn"
        style={{ background: '#fff', color: 'var(--green)', marginTop: 14, minHeight: 46 }}
        onClick={onStart}
      >
        Start the next block
      </button>
      <div className="t-caption1" style={{ opacity: 0.82, marginTop: 9 }}>
        Update your working maxes in Settings first if you tested a new single.
      </div>
    </div>
  )
}

/** The headline number for a session: its heaviest prescribed working set. */
function mainLiftSummary(
  block: ExercisePrescription | undefined,
  profile: Profile,
): string | undefined {
  if (!block) return undefined
  const exercise = getExercise(block.exerciseId)
  if (!exercise) return undefined
  const tm = profile.trainingMaxes[block.exerciseId]

  const resolved = block.sets.map((set) => ({
    set,
    ...resolveSet(set, { trainingMax: tm, profile }),
  }))
  const heaviest = resolved.reduce((best, r) =>
    (r.targetWeight ?? 0) > (best.targetWeight ?? 0) ? r : best,
  )
  const name = exercise.shortName ?? exercise.name
  const reps = describeReps(heaviest.set)
  if (!heaviest.targetWeight) {
    return `${name} · ${block.sets.length} sets · ${heaviest.loadLabel}`
  }
  const rpe = heaviest.rpe != null ? ` @ ${formatRpe(heaviest.rpe)}` : ''
  return `${name} · top ${num(heaviest.targetWeight, 1)} ${profile.units} × ${reps}${rpe}`
}

function NextSessionCard({
  date, today, name, focus, minutes, exercises, mainLift, weekLabel, deload, onStart, onPreview, isRestDay,
}: {
  date: string
  today: string
  name: string
  focus: string
  minutes: number
  exercises: number
  mainLift?: string
  weekLabel: string
  deload?: boolean
  onStart: () => void
  onPreview: () => void
  isRestDay: boolean
}) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--accent) 92%, #000) 0%, color-mix(in srgb, var(--indigo) 88%, #000) 100%)',
        color: '#fff',
      }}
    >
      <button
        type="button"
        onClick={onPreview}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '15px 16px 4px', color: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <span
            className="t-caption1 semibold"
            style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 99 }}
          >
            {isRestDay ? `Next · ${relativeDay(date, today)}` : 'Today'}
          </span>
          {deload && (
            <span
              className="t-caption1 semibold"
              style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 99 }}
            >
              Deload
            </span>
          )}
          <span className="spacer" />
          <span className="t-caption1" style={{ opacity: 0.72 }}>{weekLabel.split(' — ')[0]}</span>
        </div>

        <div style={{ fontSize: 27, lineHeight: '32px', fontWeight: 700, letterSpacing: -0.5 }}>{name}</div>
        <div className="t-subhead" style={{ opacity: 0.8, marginTop: 2 }}>{focus}</div>

        {mainLift && (
          <div
            style={{
              marginTop: 12,
              padding: '9px 11px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Icon name="bolt.fill" size={14} color="#fff" />
            <span className="t-footnote semibold mono-nums truncate">{mainLift}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, marginTop: 12, opacity: 0.82 }}>
          <span className="t-footnote" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="clock" size={13} weight={2.2} /> ~{minutes} min
          </span>
          <span className="t-footnote" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="list" size={13} weight={2.2} /> {exercises} exercises
          </span>
        </div>
      </button>

      <div style={{ padding: '12px 16px 15px' }}>
        <button
          type="button"
          onClick={onStart}
          className="btn"
          style={{ background: '#fff', color: 'var(--accent)', minHeight: 48 }}
        >
          <Icon name="play.fill" size={17} />
          {isRestDay ? 'Start early' : 'Start workout'}
        </button>
      </div>
    </div>
  )
}

function CompletedCard({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span
          style={{
            width: 46, height: 46, borderRadius: 14, flex: 'none',
            background: 'rgba(52,199,89,0.16)', display: 'grid', placeItems: 'center',
          }}
        >
          <Icon name="check" size={24} weight={2.6} color="var(--green)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-caption1 semibold" style={{ color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Session complete
          </div>
          <div className="t-title3" style={{ marginTop: 1 }}>{name}</div>
          <div className="t-footnote dim">Tap to review your sets</div>
        </div>
        <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
      </div>
    </Card>
  )
}

function ResumeCard() {
  const active = useStore((s) => s.active)!
  const program = useProgram()
  const found = program.weeks
    .find((w) => w.index === active.weekIndex)
    ?.sessions.find((s) => s.id === active.sessionId)
  const done = Object.values(active.entries).reduce((n, sets) => n + sets.length, 0)
  const total = found?.blocks.reduce((n, b) => n + b.sets.length, 0) ?? 0

  return (
    <div
      className="card"
      style={{ padding: 16, background: 'var(--accent)', color: '#fff' }}
    >
      <div className="t-caption1 semibold" style={{ opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Workout in progress
      </div>
      <div style={{ fontSize: 25, lineHeight: '30px', fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>
        {found?.name ?? 'Session'}
      </div>
      <div className="t-subhead" style={{ opacity: 0.85, marginTop: 2 }}>
        {done} of {total} sets logged
      </div>
      <button
        type="button"
        className="btn"
        style={{ background: '#fff', color: 'var(--accent)', marginTop: 14, minHeight: 46 }}
        onClick={() => navPresent('runner', { weekIndex: active.weekIndex, sessionId: active.sessionId })}
      >
        <Icon name="play.fill" size={16} />
        Resume
      </button>
    </div>
  )
}

/** Mon–Sun strip showing which sessions are done, due, or rest days. */
function WeekStrip() {
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const weekIndex = currentWeekIndex(program, today)
  const schedule = weekSchedule(program, weekIndex, logs)
  const weekStart = addDays(program.startDate, (weekIndex - 1) * 7)
  const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {LETTERS.map((letter, i) => {
        const date = addDays(weekStart, i)
        const entry = schedule.find((s) => s.date === date)
        const isToday = date === today
        const done = !!entry?.log
        const missedIt = entry && !done && date < today
        return (
          <button
            key={i}
            type="button"
            disabled={!entry}
            onClick={() =>
              entry && navPush('session', { weekIndex, sessionId: entry.session.id })
            }
            style={{
              borderRadius: 11,
              padding: '8px 2px 7px',
              background: done ? 'var(--accent)' : entry ? 'var(--grouped-2)' : 'transparent',
              border: isToday ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              // A rest day is information, not decoration. Dimming it three ways
              // over — tertiary label, then 0.55 on the cell, then 0.7 on the
              // letter — put the weekday at 1.7:1, well under anything iOS ships.
              // The fill and the dot already say which days carry a session.
              color: done ? '#fff' : entry ? 'var(--label)' : 'var(--label-2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span
              className="t-caption2 semibold"
              style={{ opacity: done || entry ? 0.72 : 1 }}
            >
              {letter}
            </span>
            {done ? (
              <Icon name="check" size={13} weight={3} color="#fff" />
            ) : entry ? (
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: missedIt ? 'var(--orange)' : 'var(--accent)',
                }}
              />
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--label-4)' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The same verdict the Weigh-In screen reaches, so the pill here and the words
 * there cannot disagree. A second copy of the bands drifted out of step the
 * moment one of them was tuned: this pill read green while the screen it links
 * to said "Slower than target".
 */
function rateTone(
  trend: { perWeek: number; marginPerWeek: number; current: number },
  target: number,
): 'good' | 'warn' | 'bad' | 'default' {
  const { status } = rateVerdict(trend.perWeek, target, trend.marginPerWeek, trend.current)
  if (status === 'on-track') return 'good'
  if (status === 'wrong-way') return 'bad'
  return 'warn'
}
