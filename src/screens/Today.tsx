import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../components/ios/Screen'
import { Card, CoachNote, SectionHeader } from '../components/Bits'
import { Icon } from '../components/Icon'
import { Button, Pill } from '../components/ios/Controls'
import { RingStack, MACRO_COLORS } from '../components/Rings'
import { Sparkline } from '../components/Charts'
import { useStore, emptyDay } from '../store/useStore'
import { useCoach } from '../store/coach'
import { CoachCard } from '../components/CoachCard'
import {
  blockSummary, currentWeekIndex, getWeek, isBlockComplete, logSetCount, missedSessions,
  nextSession, sessionsThisWeek, trainingStreak, useProgram, weekSchedule, weekTonnage,
} from '../store/selectors'
import { topPrescribedSet } from './train/prescription'
import { MEAL_PLAN } from '../data/mealPlan'
import { useDayMode } from './meals/dayMode'
import type { Profile, Units, WorkoutLog } from '../domain/types'
import type { ResolvedSet } from '../domain/strength'
import { MAIN_LIFTS, getExercise } from '../data/exercises'
import { SEED_PROFILE } from '../data/seed'
import { consumedTotals } from '../domain/nutrition'
import { formatRpe } from '../domain/strength'
import { rateVerdict, rollingSeries, summarizeTrend, weighInsInLast } from '../domain/weight'
import { formatLongDate, formatMinutes, relativeDay, timeOfDayGreeting, todayISO, addDays } from '../lib/date'
import { compact, fixed, num, signed } from '../lib/format'
import { navPresent, navPush, navSwitchTab, useNav } from '../nav/nav'
import { NumberPad } from '../components/NumberPad'
import { toast } from '../components/ios/Toast'
import '../styles/today.css'

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
  const firstName = profile.name.trim().split(' ')[0]

  // Nothing in a percentage-based block has a weight until these do, which is
  // why they outrank "Start workout" on a client's first morning.
  const maxesSet = MAIN_LIFTS.filter((l) => (profile.trainingMaxes[l.id] ?? 0) > 0).length
  const needsMaxes = maxesSet < MAIN_LIFTS.length
  const demo = isSampleClient(profile, logs)

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
          <Lede name={firstName} demo={demo} />
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
            <CompletedCard log={todaysLog} onPress={() => push('logDetail', { logId: todaysLog.id })} />
          ) : next ? (
            <NextSessionCard
              date={next.date}
              today={today}
              name={next.session.name}
              focus={next.session.focus}
              minutes={next.session.estMinutes}
              exercises={next.session.blocks.length}
              sets={next.session.blocks.reduce((n, b) => n + b.sets.length, 0)}
              top={topPrescribedSet(next.session.blocks[0], profile)}
              liftName={mainLiftName(next.session.blocks[0]?.exerciseId)}
              units={profile.units}
              weekLabel={next.week.label}
              deload={next.week.deload}
              onStart={() => navPresent('runner', { weekIndex: next.week.index, sessionId: next.session.id })}
              onPreview={() => push('session', { weekIndex: next.week.index, sessionId: next.session.id })}
              onSetMaxes={() => push('trainingMaxes')}
              isRestDay={isRestDay}
              maxesSet={maxesSet}
              maxesTotal={MAIN_LIFTS.length}
              needsMaxes={needsMaxes}
            />
          ) : null}
        </div>

        {/* ------------------------------ missed ---------------------------
            Directly under the day's session, because an overdue workout is
            part of the answer to "what am I doing today". */}
        {missed.length > 0 && (
          <div>
            <SectionHeader title="Catch up" />
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 'var(--r-inset)', flex: 'none',
                    background: 'color-mix(in srgb, var(--orange) 16%, transparent)',
                    display: 'grid', placeItems: 'center',
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
                  <div className="figure" style={{ fontSize: 'calc(21 * var(--pt))' }}>{Math.round(totals.kcal)}</div>
                  <div className="eyebrow" style={{ marginTop: 4 }}>kcal</div>
                </div>
              </RingStack>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MacroLine label="Protein" value={totals.protein} target={targets.protein} color={MACRO_COLORS.protein} />
                <MacroLine label="Carbs" value={totals.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} />
                <MacroLine label="Fat" value={totals.fat} target={targets.fat} color={MACRO_COLORS.fat} />
                {/* The figure is data; what it means is a sentence, and a
                    sentence stays in SF. */}
                <div
                  className="t-caption1"
                  style={{ marginTop: 1, color: over > 0 ? 'var(--orange-text)' : 'var(--label-2)' }}
                >
                  <span className="data">{Math.round(Math.abs(over))}</span>
                  {' '}kcal {over > 0 ? 'over target' : 'left today'}
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
            {trend ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* An average names the days it is an average of. Calling one
                      morning a seven-day average is a small lie that the pill
                      underneath then has to talk the client back out of. */}
                  <div className="eyebrow">
                    {weighDays >= 7 ? '7-day average'
                      : weighDays > 0 ? `Average · ${weighDays} of 7 days`
                      : 'Last average'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 5 }}>
                    <span className="figure" style={{ fontSize: 'calc(32 * var(--pt))' }}>{fixed(trend.current, 1)}</span>
                    <span className="figure-unit" style={{ fontSize: 'calc(16 * var(--pt))' }}>{profile.units}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {trend.reliable ? (
                      <Pill tone={rateTone(trend, profile.weeklyRateTarget)}>
                        {signed(trend.perWeek, 2)} {profile.units}/wk
                      </Pill>
                    ) : (
                      <Pill>Trend builds over a week</Pill>
                    )}
                    {profile.goalWeight > 0 && <Pill>Goal {num(profile.goalWeight, 0)}</Pill>}
                  </div>
                </div>
                {/* A sparkline of one point is an empty 92pt hole beside the
                    figure, not a chart. */}
                {series.length > 1 && (
                  <Sparkline
                    values={series.map((p) => p.avg)}
                    width={92}
                    height={44}
                    color={trend.perWeek >= 0 ? 'var(--green)' : 'var(--accent)'}
                  />
                )}
              </div>
            ) : (
              /* No weigh-ins at all. A 32px em dash where the figure goes reads
                 as a redaction; say what is missing and what makes it appear. */
              <div>
                {/* No eyebrow: the section header two lines up already says
                    Bodyweight, and labelling a figure that is not there is what
                    put an em dash under "7-day average" in the first place. */}
                <div className="t-headline">Nothing on the scale yet</div>
                <div className="t-footnote dim" style={{ marginTop: 3, lineHeight: 1.384615 }}>
                  Weigh in each morning. Jud reads the seven-day average, so one
                  reading on its own never moves anything.
                </div>
              </div>
            )}
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
                {weighIns.length === 0 ? 'Log your first weigh-in' : "Log this morning's weigh-in"}
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------ this week ------------------------ */}
        <div>
          <SectionHeader title="This week" action={{ label: 'Programme', onPress: () => navSwitchTab('train') }} />
          <Card>
            <WeekCard
              weekIndex={weekIndex}
              label={week?.deload ? 'Deload' : week?.label.split(' — ')[1]}
              done={weekProgress.done}
              total={weekProgress.total}
              streak={streak}
              weighDays={weighDays}
              startedOn={blockStartedOn}
              units={profile.units}
            />
          </Card>
          {week && (
            <div className="gutter" style={{ marginTop: 12 }}>
              <CoachNote>{week.emphasis}</CoachNote>
            </div>
          )}
        </div>

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

/**
 * The line above the hero: who this is, or whose data this is.
 *
 * A greeting with nobody to greet is not a greeting — "GOOD MORNING" over an
 * empty name reads as a string that lost its argument — so on a nameless client
 * nothing renders and the day's session simply sits under the date.
 *
 * The sample client gets the slot instead. Somebody who tapped "look around"
 * ten minutes ago is one weigh-in away from writing their own morning into
 * Alex's eight weeks, and the only thing standing between them is knowing.
 */
function Lede({ name, demo }: { name: string; demo: boolean }) {
  if (demo) {
    return (
      <div className="gutter today-lede">
        <span className="eyebrow">Sample data · {SEED_PROFILE.name}</span>
        <button
          type="button"
          className="t-subhead tint semibold hit-expand"
          /* Back to the welcome flow rather than straight into a wipe: the
             choice between the demo and their own setup is made there, and
             this is the same door, reopened. */
          onClick={() => useStore.setState({ onboarded: false })}
        >
          Set up mine
        </button>
      </div>
    )
  }
  if (!name) return null
  return (
    <div className="gutter" style={{ marginBottom: 10 }}>
      <div className="eyebrow">{timeOfDayGreeting()}, {name}</div>
    </div>
  )
}

/**
 * True while the app is still holding the sample client rather than this one.
 *
 * Derived, because nothing records it: the demo is exactly the seeded profile,
 * and once a client has renamed it and weighed in as themselves it is theirs.
 * A `demo` flag written by `resetToSeed` would say it outright, and should.
 */
function isSampleClient(profile: Profile, logs: WorkoutLog[]): boolean {
  return logs.length > 0
    && profile.name === SEED_PROFILE.name
    && profile.startWeight === SEED_PROFILE.startWeight
}

function MacroLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  // Past the target the bar fills and the number turns, so an overshoot reads
  // as an overshoot rather than as a completed goal.
  const over = target > 0 && value > target * 1.02
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="t-caption1 semibold dim">{label}</span>
        <span className="data" style={{ fontSize: 'calc(12 * var(--pt))', color: over ? 'var(--orange-text)' : undefined }}>
          {Math.round(value)}
          <span className="plan-unit">/{Math.round(target)}g</span>
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

/**
 * The day's session, in whichever state it is in.
 *
 * All four states share one shell: an eyebrow saying when, the session's name,
 * the figures that describe it, and a single filled action. It leads the screen
 * by being first and by being the only button on it — see DESIGN.md §4, and §7
 * on what a gradient hero costs everything underneath it.
 */
function HeroShell({
  eyebrow, tags, name, detail, children, facts, action, onPress,
}: {
  eyebrow: string
  tags?: ReactNode
  name: string
  detail?: string
  children?: ReactNode
  facts?: ReactNode
  action: ReactNode
  onPress?: () => void
}) {
  const body = (
    <>
      <div className="today-hero-head">
        <span className="eyebrow">{eyebrow}</span>
        <span className="spacer" />
        {tags}
      </div>
      <h2 className="today-hero-name">{name}</h2>
      {detail && <div className="t-subhead dim truncate" style={{ marginTop: 2 }}>{detail}</div>}
      {children}
      {facts && (
        <div className="today-hero-facts">
          <span className="data truncate">{facts}</span>
          {onPress && <Icon name="chevron.right" size={15} weight={2.6} className="chev" />}
        </div>
      )}
    </>
  )
  return (
    <div className="today-hero">
      {onPress ? (
        <button type="button" className="today-hero-plan pressable" onClick={onPress}>{body}</button>
      ) : (
        <div className="today-hero-plan">{body}</div>
      )}
      <div className="today-hero-act">{action}</div>
    </div>
  )
}

/**
 * The heaviest prescribed set, set as the figure it is.
 *
 * A percentage-based block has no weights until the working maxes are in, and
 * dropping the load out of the line leaves "5 reps · RPE 7" reading as the
 * whole prescription — the single most important number on the screen, simply
 * absent. The percentage is the half that is true either way, so it takes the
 * figure's place and the line underneath names what it is a share of.
 */
function TopSet({ top, liftName, units }: { top: ResolvedSet; liftName?: string; units: Units }) {
  const pending = top.targetWeight == null && top.percent != null
  return (
    <div className="today-top" data-rpe={top.rpe ?? ''}>
      <span className="eyebrow today-top-label">
        Top set{liftName ? ` · ${liftName}` : ''}
      </span>
      <span className="today-top-figure figure">
        {top.targetWeight != null ? (
          <>
            {num(top.targetWeight, 1)}
            <span className="figure-unit"> {units}</span>
            <span className="today-top-x">×</span>
            {top.repsLabel}
          </>
        ) : pending ? (
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
      {top.rpe != null ? (
        <span className="rpe-ink today-top-rpe">{formatRpe(top.rpe)}</span>
      ) : (
        <span className="today-top-rpe t-footnote dim">{top.loadLabel}</span>
      )}
      {pending && (
        <span className="today-top-pending t-caption1">
          of your {liftName ?? 'working'} max, which has no number on it yet
        </span>
      )}
    </div>
  )
}

function NextSessionCard({
  date, today, name, focus, minutes, exercises, sets, top, liftName, units, weekLabel, deload,
  onStart, onPreview, onSetMaxes, isRestDay, maxesSet, maxesTotal, needsMaxes,
}: {
  date: string
  today: string
  name: string
  focus: string
  minutes: number
  exercises: number
  sets: number
  top?: ResolvedSet
  liftName?: string
  units: Units
  weekLabel: string
  deload?: boolean
  onStart: () => void
  onPreview: () => void
  onSetMaxes: () => void
  isRestDay: boolean
  maxesSet: number
  maxesTotal: number
  needsMaxes: boolean
}) {
  return (
    <HeroShell
      eyebrow={isRestDay ? `Next · ${relativeDay(date, today)}` : 'Today'}
      tags={
        <>
          {isRestDay && <Pill>Rest day</Pill>}
          {deload && <Pill tone="tinted">Deload</Pill>}
          <span className="eyebrow">{weekLabel.split(' — ')[0]}</span>
        </>
      }
      name={name}
      detail={focus}
      facts={`~${minutes} min · ${exercises} exercises · ${sets} sets`}
      onPress={onPreview}
      action={
        /* The first morning's action is not "Start workout". Without the maxes
           every target in the runner is a dash, so the button that leads the
           screen is the one that puts weights on the block — DESIGN.md §4. The
           workout stays reachable underneath, because refusing to let someone
           train is not honesty. */
        needsMaxes ? (
          <>
            <Button icon="chart.bar" onPress={onSetMaxes}>Set your working maxes</Button>
            <p className="today-hero-why t-caption1">
              <span className="data">{maxesSet}</span> of <span className="data">{maxesTotal}</span>
              {' '}on file. Every weight in this block is a share of them.
            </p>
            <Button variant="plain" onPress={onStart}>Start workout anyway</Button>
          </>
        ) : (
          <Button icon="play.fill" onPress={onStart}>
            {isRestDay ? 'Start early' : 'Start workout'}
          </Button>
        )
      }
    >
      {top && <TopSet top={top} liftName={liftName} units={units} />}
    </HeroShell>
  )
}

function CompletedCard({ log, onPress }: { log: WorkoutLog; onPress: () => void }) {
  const worked = [
    log.durationSec ? formatMinutes(log.durationSec) : null,
    `${logSetCount(log)} sets`,
  ].filter(Boolean).join(' · ')
  return (
    <HeroShell
      eyebrow="Session complete"
      tags={<Icon name="check.circle.fill" size={19} color="var(--green)" />}
      name={log.sessionName}
      facts={
        <>
          {worked}
          {log.sessionRpe != null && (
            <> · <span className="rpe-ink" data-rpe={log.sessionRpe}>{formatRpe(log.sessionRpe)}</span></>
          )}
        </>
      }
      onPress={onPress}
      action={
        <Button variant="tinted" icon="list" onPress={onPress}>
          Review your sets
        </Button>
      }
    />
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
    <HeroShell
      eyebrow="Workout in progress"
      name={found?.name ?? 'Session'}
      facts={`${done}/${total} sets logged`}
      action={
        <Button
          icon="play.fill"
          onPress={() => navPresent('runner', { weekIndex: active.weekIndex, sessionId: active.sessionId })}
        >
          Resume
        </Button>
      }
    />
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
    <HeroShell
      eyebrow="Block complete"
      tags={<Icon name="check.circle.fill" size={19} color="var(--green)" />}
      name={program.name}
      facts={`${summary.sessions}/${summary.scheduled} sessions · ${summary.sets} sets · ${compact(summary.tonnage)} ${units}`}
      action={
        <>
          <Button onPress={onStart}>Start the next block</Button>
          <div className="t-caption1 dim" style={{ marginTop: 9 }}>
            Update your working maxes in Settings first if you tested a new single.
          </div>
        </>
      }
    />
  )
}

/**
 * The training week as one object: which days carry a session and how they
 * went, then the three counts that describe it.
 *
 * These used to be a row of tiles above the strip, which said "2 of 4" twice
 * and left the week itself as an afterthought at the bottom of the group.
 */
function WeekCard({
  weekIndex, label, done, total, streak, weighDays, startedOn, units,
}: {
  weekIndex: number
  label?: string
  done: number
  total: number
  streak: number
  weighDays: number
  startedOn?: string
  units: Units
}) {
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const schedule = weekSchedule(program, weekIndex, logs)
  const weekStart = addDays(program.startDate, (weekIndex - 1) * 7)
  const tonnage = weekTonnage(logs, weekStart, addDays(weekStart, 6))
  const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <>
      <div className="today-week-head">
        <span className="eyebrow">Week {weekIndex}{label ? ` · ${label}` : ''}</span>
        <span className="spacer" />
        <span className="data" style={{ fontSize: 'calc(13 * var(--pt))' }}>
          {done}/{total}<span className="plan-unit"> done</span>
        </span>
      </div>

      <div className="today-week-days">
        {LETTERS.map((letter, i) => {
          const date = addDays(weekStart, i)
          const entry = schedule.find((s) => s.date === date)
          const isToday = date === today
          // A session scheduled before the client's first day was never theirs
          // to miss — a Thursday sign-up should not open on two red Mondays.
          // Nor was it ever due: week one of a client who started on Friday has
          // four days that belong to nobody, and painting them the accent's
          // "due" blue invents three sessions they were never offered.
          const before = !!startedOn && date < startedOn
          const state = !entry ? 'rest'
            : entry.log ? 'done'
            : isToday ? 'today'
            : before ? 'before'
            : date < today ? 'missed'
            : 'due'
          return (
            <button
              key={i}
              type="button"
              className="today-day"
              data-state={state}
              disabled={!entry}
              aria-label={
                entry
                  ? `${entry.session.name}, ${relativeDay(date, today)} — ${
                      state === 'done' ? 'completed'
                        : state === 'missed' ? 'missed'
                        : state === 'before' ? 'before you started'
                        : 'scheduled'
                    }`
                  : `${relativeDay(date, today)} — rest day`
              }
              onClick={() => entry && navPush('session', { weekIndex, sessionId: entry.session.id })}
            >
              <span className="eyebrow today-day-wd" aria-hidden="true">{letter}</span>
              <span className="data today-day-num" aria-hidden="true">
                {Number(date.slice(8))}
              </span>
              <span className="today-day-mark" aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {/* Three counts the strip above cannot show. It said how many sessions
          are done twice over when this row led with that as well.

          In week zero all three are honestly zero, and three full-weight zeros
          read as an emphatic nothing. They keep their place and step back a
          tone until there is something to report. */}
      <div className="today-week-stats">
        <WeekStat value={streak} label="Streak" zero={streak === 0} />
        <WeekStat
          value={<>{compact(tonnage)}<span className="plan-unit"> {units}</span></>}
          label="Moved"
          zero={tonnage === 0}
        />
        <WeekStat
          value={`${weighDays}/7`}
          label="Weigh-ins"
          zero={weighDays === 0}
          tone={weighDays >= 5 ? 'var(--green-text)' : undefined}
        />
      </div>
    </>
  )
}

function WeekStat({
  value, label, tone, zero,
}: {
  value: ReactNode
  label: string
  tone?: string
  zero?: boolean
}) {
  return (
    <div className="today-stat" data-zero={zero ? 'true' : undefined}>
      <span className="data today-stat-value truncate" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="eyebrow today-stat-label truncate">{label}</span>
    </div>
  )
}

/** The short name of a session's main lift, for the top-set label. */
function mainLiftName(exerciseId?: string): string | undefined {
  if (!exerciseId) return undefined
  const exercise = getExercise(exerciseId)
  return exercise?.shortName ?? exercise?.name
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
