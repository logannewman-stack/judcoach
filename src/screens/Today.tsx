import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Screen } from '../components/ios/Screen'
import { Card, CoachNote, SectionHeader } from '../components/Bits'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Pill } from '../components/ios/Controls'
import { Alert } from '../components/ios/Sheet'
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
import { FuelReadout, kcalStanding } from './meals/fuel'
import type { ActiveSession, Profile, Units, WorkoutLog } from '../domain/types'
import type { ResolvedSet } from '../domain/strength'
import { MAIN_LIFTS, getExercise } from '../data/exercises'
import { SEED_PROFILE } from '../data/seed'
import { consumedTotals } from '../domain/nutrition'
import { formatRpe } from '../domain/strength'
import { rateVerdict, rollingSeries, summarizeTrend, weighInsInLast } from '../domain/weight'
import { formatLongDate, formatMinutes, relativeDay, timeOfDayGreeting, todayISO, addDays } from '../lib/date'
import { compact, fixed, num, pluralize, signed, weight } from '../lib/format'
import { navPresent, navPush, navSwitchTab, useNav } from '../nav/nav'
import { LogSheet } from './weigh/WeighInHome'
import { toast } from '../components/ios/Toast'
import '../styles/today.css'

export function TodayScreen() {
  const coachSeat = useCoach((s) => s.viewAs === 'coach')
  const heard = useCoach((s) => s.notes.some((n) => n.author !== s.viewAs))
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const weighIns = useStore((s) => s.weighIns)
  const nutrition = useStore((s) => s.nutrition)
  const active = useStore((s) => s.active)
  const push = useNav((s) => s.push)
  const saveWeighIn = useStore((s) => s.saveWeighIn)
  // The Weigh-In screen reads every figure at the client's own precision; the
  // same average shown here at a hard-coded one decimal read 185.1 beside its
  // own 185.
  const decimals = useStore((s) => s.settings.weightUnitDecimals)
  const [loggingWeight, setLoggingWeight] = useState(false)
  const [rollingBlock, setRollingBlock] = useState(false)

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
  const kcal = kcalStanding(targets, totals)

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
        <div className="gutter today-screen" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim">{formatLongDate(today)}</div>
        </div>
      }
      right={{ icon: 'person', onPress: () => push('coach'), ariaLabel: 'Your coach' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div className="today-screen" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ------------------------------ hero ----------------------------- */}
        <Rise order={0}>
          <Lede name={firstName} demo={demo} />
          {blockDone ? (
            <BlockCompleteCard
              program={program}
              logs={logs}
              units={profile.units}
              // Rolling the block over clears the running session with it, and
              // the card that offers it is the one the client taps once the
              // block is complete — the Resume card is not even rendered in
              // that state. So a workout with sets in it gets the same
              // two-button warning the Runner's own discard gives; without it
              // the sets went with no alert and no way back.
              onStart={() => {
                if (active) { setRollingBlock(true); return }
                startNextBlock()
                toast('New block started', { icon: 'check.circle.fill', tone: 'good' })
              }}
            />
          ) : active ? (
            <ResumeCard />
          ) : todaysLog ? (
            <CompletedCard
              log={todaysLog}
              onPress={() => push('logDetail', { logId: todaysLog.id })}
              onSetMaxes={() => push('trainingMaxes')}
              maxesSet={maxesSet}
              maxesTotal={MAIN_LIFTS.length}
              needsMaxes={needsMaxes}
            />
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
        </Rise>

        {/* ------------------------------ missed ---------------------------
            Directly under the day's session, because an overdue workout is
            part of the answer to "what am I doing today". */}
        {missed.length > 0 && (
          <Rise order={1} domain="train">
            <SectionHeader title={<SecTitle icon="clock">Catch up</SecTitle>} />
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span className="train-goal-badge">
                  <Icon name="clock" size={19} weight={2.2} />
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
          </Rise>
        )}

        {/* ---------------------------- nutrition -------------------------- */}
        <Rise order={2} domain="meals">
          {/* A rest day quietly serves different targets and different portions;
              say which plan these numbers came from rather than letting 330 kcal
              move on its own. */}
          <SectionHeader
            title={
              <SecTitle icon="fork.fill">
                {restDay ? (
                  <>
                    Fuel <span className="t-subhead dim" style={{ fontWeight: 400 }}>· Rest day</span>
                  </>
                ) : (
                  'Fuel'
                )}
              </SecTitle>
            }
            action={{ label: 'Log meals', onPress: () => navSwitchTab('meals') }}
          />
          <Card onPress={() => navSwitchTab('meals')}>
            {/* The Meals screen's own card, rather than a second one drawn to
                different measurements: two implementations gave the same three
                numbers opposite verdicts thirty pixels apart. */}
            <FuelReadout targets={targets} totals={totals} />
            {/* The figure is data; what it means is a sentence, and a sentence
                stays in SF. The slack comes with the card, so a day followed
                exactly cannot read "1 kcal over target" here and "the day
                exactly as written" on Meals. */}
            <div className="t-caption1 fuel-note" data-tone={kcal.state} style={{ marginTop: 12 }}>
              {kcal.state === 'met' ? (
                <>Calories are on target.</>
              ) : (
                <>
                  <span className="data">{Math.abs(kcal.left)}</span>
                  {' '}kcal {kcal.state === 'over' ? 'over target' : 'left today'}
                </>
              )}
            </div>
          </Card>
        </Rise>

        {/* ------------------------------ weight --------------------------- */}
        <Rise order={3} domain="weigh">
          <SectionHeader
            title={<SecTitle icon="chart.line">Bodyweight</SecTitle>}
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
                    <span className="figure" style={{ fontSize: 'calc(38 * var(--pt))' }}>{fixed(trend.current, decimals)}</span>
                    <span className="figure-unit" style={{ fontSize: 'calc(17 * var(--pt))' }}>{profile.units}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {trend.reliable ? (
                      <Pill tone={rateTone(trend, profile.weeklyRateTarget)}>
                        {signed(trend.perWeek, 2)} {profile.units}/wk
                      </Pill>
                    ) : (
                      <Pill>Trend builds over a week</Pill>
                    )}
                    {/* A weight with no unit beside one that has one reads as
                        a different quantity altogether. */}
                    {profile.goalWeight > 0 && (
                      <Pill>Goal {weight(profile.goalWeight, profile.units, decimals)}</Pill>
                    )}
                  </div>
                </div>
                {/* A sparkline of one point is an empty 92pt hole beside the
                    figure, not a chart. */}
                {series.length > 1 && (
                  <Sparkline
                    values={series.map((p) => p.avg)}
                    width={92}
                    height={46}
                    color="var(--tint)"
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
            <div className="gutter" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-tinted btn-sm"
                style={{ width: '100%', minHeight: 44 }}
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
        </Rise>

        {/* ------------------------------ this week ------------------------ */}
        <Rise order={4} domain="train">
          <SectionHeader
            title={<SecTitle icon="dumbbell.fill">This week</SecTitle>}
            action={{ label: 'Programme', onPress: () => navSwitchTab('train') }}
          />
          <Card>
            <WeekCard
              weekIndex={weekIndex}
              label={week?.deload ? 'Deload' : week?.label.split(' — ')[1]}
              done={weekProgress.done}
              total={weekProgress.total}
              streak={streak}
              startedOn={blockStartedOn}
              units={profile.units}
              emphasis={week?.emphasis}
            />
          </Card>
        </Rise>

        {/* ------------------------------- coach --------------------------- */}
        <Rise order={5} domain="coach">
          {/* CoachCard falls back to a plain profile row when nothing has been
              said, and "From Jud" over Jud's own name, title and credentials
              headlines a message that does not exist. Same test as the card's,
              so the heading and what is under it cannot disagree. */}
          <SectionHeader
            title={
              <SecTitle icon="message.fill">
                {!heard ? 'Your coach' : coachSeat ? 'From your client' : 'From Jud'}
              </SecTitle>
            }
            action={{ label: 'Profile', onPress: () => navPush('coach') }}
          />
          <div className="gutter">
            <CoachCard />
          </div>
        </Rise>
      </div>

      <Alert
        open={rollingBlock}
        title="Finish the workout first?"
        message={
          activeSetCount(active) > 0
            ? <>Starting the next block ends the session you have open. The{' '}
              <span className="data">{activeSetCount(active)}</span> sets logged in it
              will be deleted, and that cannot be undone.</>
            : <>Starting the next block ends the session you have open. This cannot be undone.</>
        }
        onDismiss={() => setRollingBlock(false)}
        actions={[
          { label: 'Cancel', onPress: () => setRollingBlock(false) },
          {
            label: 'Start the next block',
            destructive: true,
            onPress: () => {
              setRollingBlock(false)
              startNextBlock()
              toast('New block started', { icon: 'check.circle.fill', tone: 'good' })
            },
          },
        ]}
      />

      {/* The Weigh-In tab's own sheet, not a second copy of it. The copy here
          had no zero guard, so a client with no start weight on file who
          pressed Save untouched filed a bodyweight of 0. */}
      <LogSheet
        open={loggingWeight}
        onClose={() => setLoggingWeight(false)}
        initial={weighIns[weighIns.length - 1]?.weight ?? profile.startWeight}
        onSave={(w) => {
          saveWeighIn({ date: today, weight: w })
          toast(`${fixed(w, decimals)} ${profile.units} logged`, { icon: 'scale', tone: 'good' })
        }}
      />
    </Screen>
  )
}

/* ------------------------------ sub-components --------------------------- */

/**
 * A group of the screen, arriving.
 *
 * Each one comes up a little past its resting place and settles, a beat after
 * the one above it — DESIGN.md §5. With reduced motion on, nothing moves and
 * the screen is simply already there, which is the same screen.
 *
 * It also carries the section's domain, which is what colours everything
 * inside it: Today is a map of the other four tabs, so the plate is green, the
 * scale violet, the training week orange and Jud pink.
 */
function Rise({
  order, domain, children,
}: {
  order: number
  domain?: 'train' | 'meals' | 'weigh' | 'coach'
  children: ReactNode
}) {
  const still = useReducedMotion()
  if (still) {
    return <div className="today-sec" data-domain={domain}>{children}</div>
  }
  return (
    <motion.div
      className="today-sec"
      data-domain={domain}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9, delay: order * 0.045 }}
    >
      {children}
    </motion.div>
  )
}

/** A section heading with its domain's symbol in front of it. */
function SecTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="sec-title">
      <span className="sec-badge" aria-hidden="true">
        <Icon name={icon} size={15} weight={2.2} />
      </span>
      {children}
    </span>
  )
}

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
    <div className="gutter today-greeting">
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

/**
 * The day's session, in whichever state it is in.
 *
 * All four states share one shell: an eyebrow saying when, the session's name,
 * the figures that describe it, and a single filled action.
 *
 * It is washed in the screen's own hue — the one gradient DESIGN.md §2 puts on
 * a hero card, two stops inside one family — because a client opening the app
 * at seven in the morning should find the thing to do today already lit. The
 * exception is `done`: once the work is banked there is nothing to lead them
 * to, so the card steps back to a white one with a green tick and the colour
 * on the screen moves to whatever still wants doing.
 */
function HeroShell({
  eyebrow, tags, name, detail, children, facts, action, onPress, done,
}: {
  eyebrow: string
  tags?: ReactNode
  name: string
  detail?: string
  children?: ReactNode
  facts?: ReactNode
  action: ReactNode
  onPress?: () => void
  done?: boolean
}) {
  const body = (
    <>
      <div className="today-hero-head">
        <span className="eyebrow">{eyebrow}</span>
        <span className="spacer" />
        {tags}
      </div>
      <h2 className="today-hero-name">{name}</h2>
      {detail && <div className="today-hero-detail truncate">{detail}</div>}
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
    <div className="today-hero" data-tone={done ? 'done' : undefined}>
      {onPress ? (
        <button type="button" className="today-hero-plan" onClick={onPress}>{body}</button>
      ) : (
        <div className="today-hero-plan">{body}</div>
      )}
      <div className="today-hero-act">{action}</div>
    </div>
  )
}

/**
 * The hero's own button.
 *
 * A white capsule inked in the card's deep stop — which is to say the card's
 * own colour, inverted. It is what iOS puts on a coloured card, and it is the
 * loudest control on the screen without borrowing a second hue to be it.
 */
function HeroButton({
  children, onPress, icon,
}: {
  children: ReactNode
  onPress: () => void
  icon?: IconName
}) {
  return (
    <button type="button" className="btn btn-on-wash" onClick={onPress}>
      {icon && <Icon name={icon} size={19} weight={2.1} />}
      {children}
    </button>
  )
}

/**
 * The heaviest prescribed set, set as the figure it is — the biggest number on
 * the screen, because it is the one a lifter is actually deciding about on the
 * way to the gym.
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
      {top.rpe != null ? (
        <span className="rpe-ink today-top-rpe">
          {/* On the wash the type has to be white, so the ramp is carried by
              the pip instead — the one place its colour has to be exact. */}
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
        needsMaxes ? (
          <MaxesRung
            set={maxesSet}
            total={maxesTotal}
            onPress={onSetMaxes}
            alt={<button type="button" className="btn btn-plain" onClick={onStart}>Start workout anyway</button>}
          />
        ) : (
          <HeroButton icon="play.fill" onPress={onStart}>
            {isRestDay ? 'Start early' : 'Start workout'}
          </HeroButton>
        )
      }
    >
      {top && <TopSet top={top} liftName={liftName} units={units} />}
    </HeroShell>
  )
}

/**
 * The setup step that outranks whatever the hero would otherwise offer.
 *
 * The first morning's action is not "Start workout", and it is not "Review your
 * sets" either. Without the maxes every target in the runner is a dash, so the
 * button that leads the screen is the one that puts weights on the block —
 * DESIGN.md §4. Whatever the hero came to say stays reachable underneath,
 * because refusing to let someone train is not honesty.
 */
function MaxesRung({
  set, total, onPress, alt,
}: {
  set: number
  total: number
  onPress: () => void
  alt: ReactNode
}) {
  return (
    <>
      <HeroButton icon="chart.bar" onPress={onPress}>Set your working maxes</HeroButton>
      <p className="today-hero-why t-caption1">
        <span className="data">{set}</span> of <span className="data">{total}</span>
        {' '}on file. Every weight in this block is a share of them.
      </p>
      {alt}
    </>
  )
}

function CompletedCard({
  log, onPress, onSetMaxes, maxesSet, maxesTotal, needsMaxes,
}: {
  log: WorkoutLog
  onPress: () => void
  onSetMaxes: () => void
  maxesSet: number
  maxesTotal: number
  needsMaxes: boolean
}) {
  const worked = [
    log.durationSec ? formatMinutes(log.durationSec) : null,
    pluralize(logSetCount(log), 'set'),
  ].filter(Boolean).join(' · ')
  return (
    <HeroShell
      done
      eyebrow="Session complete"
      tags={<Icon name="check.circle.fill" size={21} color="var(--green)" />}
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
        /* A session trained without targets is exactly when to ask for them:
           tomorrow's is otherwise another page of dashes. */
        needsMaxes ? (
          <MaxesRung
            set={maxesSet}
            total={maxesTotal}
            onPress={onSetMaxes}
            alt={<button type="button" className="btn btn-plain" onClick={onPress}>Review your sets</button>}
          />
        ) : (
          <button type="button" className="btn btn-tinted" onClick={onPress}>
            <Icon name="list" size={19} weight={2.1} />
            Review your sets
          </button>
        )
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
  const done = activeSetCount(active)
  const total = found?.blocks.reduce((n, b) => n + b.sets.length, 0) ?? 0

  return (
    <HeroShell
      eyebrow="Workout in progress"
      name={found?.name ?? 'Session'}
      facts={`${done}/${total} sets logged`}
      action={
        <HeroButton
          icon="play.fill"
          onPress={() => navPresent('runner', { weekIndex: active.weekIndex, sessionId: active.sessionId })}
        >
          Resume
        </HeroButton>
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
      tags={<Icon name="seal.fill" size={21} color="#fff" />}
      name={program.name}
      facts={`${summary.sessions}/${summary.scheduled} sessions · ${summary.sets} sets · ${compact(summary.tonnage)} ${units}`}
      action={
        <>
          <HeroButton onPress={onStart}>Start the next block</HeroButton>
          <p className="today-hero-why t-caption1">
            Update your working maxes in Settings first if you tested a new single.
          </p>
        </>
      }
    />
  )
}

/**
 * The training week as one object: which days carry a session and how they
 * went, then the three counts that describe it.
 *
 * Seven bubbles, each coloured by what that day turned out to be — banked,
 * missed, owed, or nobody's. It is the warmest thing on the screen after the
 * hero, because a training week is what the client is actually here for.
 */
function WeekCard({
  weekIndex, label, done, total, streak, startedOn, units, emphasis,
}: {
  weekIndex: number
  label?: string
  done: number
  total: number
  streak: number
  startedOn?: string
  units: Units
  emphasis?: string
}) {
  const today = todayISO()
  const still = useReducedMotion()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const weighIns = useStore((s) => s.weighIns)
  const schedule = weekSchedule(program, weekIndex, logs)
  const weekStart = addDays(program.startDate, (weekIndex - 1) * 7)
  const weekEnd = addDays(weekStart, 6)
  const tonnage = weekTonnage(logs, weekStart, weekEnd)
  // The Monday-to-Sunday the strip above draws, not the rolling window the
  // trend card upstairs counts in: under a "Week n" heading, beside a tonnage
  // scoped to the same seven days, "5/7" can only mean these seven days.
  const weighDays = new Set(
    weighIns.filter((w) => w.date >= weekStart && w.date <= weekEnd).map((w) => w.date),
  ).size
  const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const pct = total > 0 ? (done / total) * 100 : 0

  return (
    <>
      <div className="today-week-head">
        <span className="eyebrow">Week {weekIndex}{label ? ` · ${label}` : ''}</span>
        <span className="spacer" />
        <span className="data" style={{ fontSize: 'calc(13 * var(--pt))' }}>
          {done}/{total}<span className="plan-unit"> done</span>
        </span>
      </div>

      <div className="track">
        <motion.div
          className="track-fill"
          initial={still ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 130, damping: 20, delay: 0.1 }}
        />
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
        <WeekStat
          value={streak}
          label="Streak"
          zero={streak === 0}
          tone={streak > 0 ? 'var(--tint-ink)' : undefined}
        />
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

      {/* Jud's instruction for the week, on the same surface as the week it is
          about rather than loose on the ground under it. */}
      {emphasis && (
        <div style={{ marginTop: 15 }}>
          <CoachNote>{emphasis}</CoachNote>
        </div>
      )}
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
      <span className="figure today-stat-value truncate" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="eyebrow today-stat-label truncate">{label}</span>
    </div>
  )
}

/** How much work the open session is holding: what the Resume card counts, and
    what the warning before the block rolls over has to name. */
function activeSetCount(active: ActiveSession | null): number {
  if (!active) return 0
  return Object.values(active.entries).reduce((n, sets) => n + sets.length, 0)
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
