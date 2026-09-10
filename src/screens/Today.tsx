import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../components/ios/Screen'
import { Card, CoachAvatar, CoachNote, SectionHeader, StatTile } from '../components/Bits'
import { Icon } from '../components/Icon'
import { Pill } from '../components/ios/Controls'
import { RingStack, MACRO_COLORS } from '../components/Rings'
import { Sparkline } from '../components/Charts'
import { useStore, emptyDay } from '../store/useStore'
import {
  currentWeekIndex, getWeek, missedSessions, nextSession, sessionsThisWeek,
  trainingStreak, useProgram, weekSchedule,
} from '../store/selectors'
import { MEAL_PLAN } from '../data/mealPlan'
import type { ExercisePrescription, Profile } from '../domain/types'
import { getExercise } from '../data/exercises'
import { consumedTotals } from '../domain/nutrition'
import { describeReps, formatRpe, resolveSet } from '../domain/strength'
import { rollingSeries, summarizeTrend, weighInStreak } from '../domain/weight'
import { formatLongDate, relativeDay, timeOfDayGreeting, todayISO, addDays } from '../lib/date'
import { fixed, num, signed } from '../lib/format'
import { navPresent, navPush, navSwitchTab, useNav } from '../nav/nav'
import { COACH } from '../data/seed'

export function TodayScreen() {
  const today = todayISO()
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const profile = useStore((s) => s.profile)
  const weighIns = useStore((s) => s.weighIns)
  const nutrition = useStore((s) => s.nutrition)
  const active = useStore((s) => s.active)
  const push = useNav((s) => s.push)

  const weekIndex = currentWeekIndex(program, today)
  const week = getWeek(program, weekIndex)
  const next = useMemo(() => nextSession(program, logs, today), [program, logs, today])
  const missed = useMemo(() => missedSessions(program, logs, today), [program, logs, today])
  const weekProgress = sessionsThisWeek(program, logs, today)
  const streak = trainingStreak(program, logs, today)

  const day = nutrition[today] ?? emptyDay(today)
  const totals = consumedTotals(MEAL_PLAN, day)
  const targets = MEAL_PLAN.targets

  const trend = useMemo(() => summarizeTrend(weighIns, 28), [weighIns])
  const series = useMemo(() => rollingSeries(weighIns, 7).slice(-21), [weighIns])
  const weighStreak = weighInStreak(weighIns, today)
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {/* ------------------------------ hero ----------------------------- */}
        <div>
          <div className="gutter" style={{ marginBottom: 10 }}>
            <div className="t-footnote dim semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {timeOfDayGreeting()}, {profile.name.split(' ')[0]}
            </div>
          </div>
          {active ? (
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
          <SectionHeader title="Fuel" action={{ label: 'Log meals', onPress: () => navSwitchTab('meals') }} />
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
                <div className="t-caption1 dim" style={{ marginTop: 1 }}>
                  {Math.max(0, Math.round(targets.kcal - totals.kcal))} kcal left today
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
                    <Pill tone={rateTone(trend.perWeek, profile.weeklyRateTarget)}>
                      {signed(trend.perWeek, 2)} {profile.units}/wk
                    </Pill>
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
            {!loggedToday && (
              <div
                className="t-footnote"
                style={{ marginTop: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Icon name="plus" size={13} weight={2.6} />
                Log this morning's weigh-in
              </div>
            )}
          </Card>
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
              value={weighStreak}
              caption={weighStreak === 1 ? 'day' : 'days'}
              icon="scale"
              tone={weighStreak >= 5 ? 'var(--green)' : undefined}
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
          <SectionHeader title="Your coach" />
          <Card onPress={() => navPush('coach')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CoachAvatar size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-headline">{COACH.fullName}</div>
                <div className="t-footnote dim truncate">{COACH.title} · {COACH.credentials}</div>
              </div>
              <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  )
}

/* ------------------------------ sub-components --------------------------- */

function MacroLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="t-caption1 semibold dim">{label}</span>
        <span className="t-caption1 mono-nums semibold">
          {Math.round(value)}
          <span className="dim" style={{ fontWeight: 400 }}>/{Math.round(target)}g</span>
        </span>
      </div>
      <div className="track" style={{ height: 5, marginTop: 3 }}>
        <motion.div
          className="track-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
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
              color: done ? '#fff' : entry ? 'var(--label)' : 'var(--label-3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              opacity: entry ? 1 : 0.55,
            }}
          >
            <span className="t-caption2 semibold" style={{ opacity: 0.7 }}>{letter}</span>
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

function rateTone(perWeek: number, target: number): 'good' | 'warn' | 'bad' | 'default' {
  if (Math.abs(target) < 0.05) return Math.abs(perWeek) <= 0.35 ? 'good' : 'warn'
  if (Math.sign(perWeek) !== Math.sign(target) && Math.abs(perWeek) > 0.1) return 'bad'
  const ratio = Math.abs(perWeek) / Math.abs(target)
  if (ratio < 0.5 || ratio > 1.6) return 'warn'
  return 'good'
}
