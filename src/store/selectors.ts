import { useMemo } from 'react'
import type {
  ExercisePrescription, LoggedSet, Program, SessionTemplate, WeekTemplate, WorkoutLog,
} from '../domain/types'
import { getProgram } from '../data/program'
import { getExercise } from '../data/exercises'
import { bestE1RM, e1RM, isMaxEffort, sessionTonnage } from '../domain/strength'
import { addDays, daysBetween, todayISO } from '../lib/date'
import { useStore } from './useStore'

/* ------------------------------- programme ------------------------------ */

export { getProgram }

export function useProgram(): Program {
  const startDate = useStore((s) => s.programStartDate)
  const blockNumber = useStore((s) => s.blockNumber)
  const blockStartedOn = useStore((s) => s.blockStartedOn)
  const units = useStore((s) => s.profile.units)
  /* The built programme is memoised on what builds it and shared by every
     caller, and the day this client rolled over is not part of that — it is a
     fact about the person, like the block number. So it is stamped onto a copy
     here rather than written into the shared object. `units` does belong to the
     build (it is the goal line's unit) and has to be a dependency of this memo
     as well as an argument, or a switch hands back the sentence it replaced. */
  return useMemo(
    () => ({ ...getProgram(startDate, blockNumber, units), blockStartedOn }),
    [startDate, blockNumber, units, blockStartedOn],
  )
}

/** The block runs Monday-first; templates store weekday as 0=Sunday. */
export const weekdayOffset = (weekday: number): number => (weekday + 6) % 7

export function sessionDate(program: Program, weekIndex: number, weekday: number): string {
  const weekStart = addDays(program.startDate, (weekIndex - 1) * 7)
  return addDays(weekStart, weekdayOffset(weekday))
}

export function currentWeekIndex(program: Program, today = todayISO()): number {
  const elapsed = daysBetween(program.startDate, today)
  const index = Math.floor(elapsed / 7) + 1
  return Math.min(Math.max(index, 1), program.weeks.length)
}

export function getWeek(program: Program, index: number): WeekTemplate | undefined {
  return program.weeks.find((w) => w.index === index)
}

export function findSession(
  program: Program,
  weekIndex: number,
  sessionId: string,
): { week: WeekTemplate; session: SessionTemplate } | undefined {
  const week = getWeek(program, weekIndex)
  const session = week?.sessions.find((s) => s.id === sessionId)
  return week && session ? { week, session } : undefined
}

export interface ScheduledSession {
  week: WeekTemplate
  session: SessionTemplate
  date: string
  log?: WorkoutLog
}

/**
 * The first day whose logs belong to the block currently running.
 *
 * A block's calendar hangs off the Monday of its first week, but a client rolls
 * over on whatever day they tap the button, and `startNextBlock` backdates
 * `programStartDate` to the Monday just gone so week one is this week. Flooring
 * on that Monday therefore swept up the sessions trained on it under the block
 * that was still running: rolling over on a Friday handed the new block's week
 * five three of the old block's logs, dated four weeks before the week they were
 * being counted in. `blockStartedOn` is the day the client actually crossed
 * over, and it is the honest floor. Guarded rather than taken, because an
 * imported file can carry one of the two dates without the other.
 */
const blockFloor = (program: Program): string =>
  program.blockStartedOn && program.blockStartedOn > program.startDate
    ? program.blockStartedOn
    : program.startDate

/**
 * Whether a log belongs to the block currently running.
 *
 * A session id carries its week and its slot — `w1-lowerA` — but not the block,
 * so the ids repeat every time a client rolls into the next eight weeks. Matching
 * on the id alone handed block four's first month block three's logs: the week
 * read 4/4 done against sessions nobody had trained, the streak counted them, and
 * the next session jumped four weeks past the one actually due. A log is dated
 * the day it was finished, so the day the block began is what separates this
 * `w1-lowerA` from the last one's.
 */
const inBlock = (program: Program, log: WorkoutLog): boolean => log.date >= blockFloor(program)

/** The log that belongs to one session of *this* block, if it has been trained. */
export function findSessionLog(
  program: Program,
  logs: WorkoutLog[],
  sessionId: string,
): WorkoutLog | undefined {
  return logs.find((l) => l.sessionId === sessionId && inBlock(program, l))
}

/** Every session in a week, with its calendar date and any completed log. */
export function weekSchedule(
  program: Program,
  weekIndex: number,
  logs: WorkoutLog[],
): ScheduledSession[] {
  const week = getWeek(program, weekIndex)
  if (!week) return []
  return week.sessions.map((session) => {
    const date = sessionDate(program, weekIndex, session.weekday)
    return { week, session, date, log: findSessionLog(program, logs, session.id) }
  })
}

/**
 * What the client should train next: today's session if there is one, else the
 * next unfinished session in the current or following week.
 */
export function nextSession(
  program: Program,
  logs: WorkoutLog[],
  today = todayISO(),
): ScheduledSession | undefined {
  const start = currentWeekIndex(program, today)
  for (let w = start; w <= program.weeks.length; w++) {
    const schedule = weekSchedule(program, w, logs)
    const dueToday = schedule.find((s) => s.date === today && !s.log)
    if (dueToday) return dueToday
    const upcoming = schedule.find((s) => s.date >= today && !s.log)
    if (upcoming) return upcoming
  }
  // Everything scheduled is done — surface the most recent session instead.
  const schedule = weekSchedule(program, start, logs)
  return schedule[schedule.length - 1]
}

/**
 * Sessions scheduled before today and never logged.
 *
 * `since` is the day the client actually started, so a Thursday sign-up is not
 * greeted with two overdue workouts from a Monday they had no account for.
 */
export function missedSessions(
  program: Program,
  logs: WorkoutLog[],
  today = todayISO(),
  since?: string,
): ScheduledSession[] {
  const out: ScheduledSession[] = []
  const upTo = currentWeekIndex(program, today)
  const floor = since ?? blockFloor(program)
  for (let w = 1; w <= upTo; w++) {
    for (const s of weekSchedule(program, w, logs)) {
      if (s.date < today && s.date >= floor && !s.log) out.push(s)
    }
  }
  return out
}

/** True once the block's last week is behind the client. */
export function isBlockComplete(program: Program, today = todayISO()): boolean {
  return daysBetween(program.startDate, today) >= program.weeks.length * 7
}

/** Everything the client did across the block, for the completion summary. */
export function blockSummary(program: Program, logs: WorkoutLog[]) {
  const end = addDays(program.startDate, program.weeks.length * 7 - 1)
  const inBlock = logs.filter((l) => l.date >= blockFloor(program) && l.date <= end)
  const scheduled = program.weeks.reduce((n, w) => n + w.sessions.length, 0)
  return {
    sessions: inBlock.length,
    scheduled,
    sets: inBlock.reduce((n, l) => n + logSetCount(l), 0),
    tonnage: inBlock.reduce((n, l) => n + logTonnage(l), 0),
  }
}

/* ------------------------------- history -------------------------------- */

export interface Performance {
  date: string
  sets: LoggedSet[]
  logId: string
}

/** The most recent time this movement was trained, for the "last time" anchor. */
export function lastPerformance(
  logs: WorkoutLog[],
  exerciseId: string,
  beforeDate = todayISO(),
): Performance | undefined {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    if (log.date > beforeDate) continue
    const ex = log.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
    if (ex) return { date: log.date, sets: ex.sets, logId: log.id }
  }
  return undefined
}

/** Every session in which the movement appears, newest first. */
export function performanceHistory(logs: WorkoutLog[], exerciseId: string): Performance[] {
  return [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((log) => {
      const ex = log.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0)
      return ex ? [{ date: log.date, sets: ex.sets, logId: log.id }] : []
    })
}

export interface E1RMPoint {
  date: string
  value: number
}

export function e1rmSeries(logs: WorkoutLog[], exerciseId: string): E1RMPoint[] {
  return performanceHistory(logs, exerciseId)
    .map((p) => ({ date: p.date, value: bestE1RM(p.sets) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface PersonalRecord {
  exerciseId: string
  /** Best estimated one-rep max from max-effort sets; 0 when none qualify. */
  e1rm: number
  /** True when `e1rm` rests on a real max-effort set. */
  hasEstimate: boolean
  /** The set that produced the record. */
  weight: number
  reps: number
  rpe?: number
  date: string
  /** Heaviest weight lifted for any rep count. */
  topWeight: number
}

export function personalRecords(logs: WorkoutLog[]): PersonalRecord[] {
  const byExercise = new Map<string, PersonalRecord>()
  for (const log of logs) {
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (s.warmup || s.weight <= 0) continue
        const qualifies = isMaxEffort(s)
        const est = qualifies ? e1RM(s.weight, s.reps, s.rpe) : 0
        const current = byExercise.get(ex.exerciseId)
        if (!current) {
          byExercise.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            e1rm: est,
            hasEstimate: qualifies,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            date: log.date,
            topWeight: s.weight,
          })
          continue
        }
        // An estimate always beats no estimate; otherwise the heavier one wins.
        const better = qualifies
          ? !current.hasEstimate || est > current.e1rm
          : !current.hasEstimate && s.weight > current.weight
        if (better) {
          Object.assign(current, {
            e1rm: est,
            hasEstimate: current.hasEstimate || qualifies,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            date: log.date,
          })
        }
        if (s.weight > current.topWeight) current.topWeight = s.weight
      }
    }
  }
  // Estimated maxes first, then everything else by the heaviest weight handled.
  return [...byExercise.values()].sort((a, b) => {
    if (a.hasEstimate !== b.hasEstimate) return a.hasEstimate ? -1 : 1
    return a.hasEstimate ? b.e1rm - a.e1rm : b.topWeight - a.topWeight
  })
}

/** Best estimated max ever logged for one movement, from max-effort sets only. */
export function bestHistoricalE1RM(logs: WorkoutLog[], exerciseId: string): number {
  let best = 0
  for (const log of logs) {
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue
      for (const set of ex.sets) {
        if (!isMaxEffort(set)) continue
        best = Math.max(best, e1RM(set.weight, set.reps, set.rpe))
      }
    }
  }
  return best
}

/* -------------------------------- volume -------------------------------- */

export type VolumeByMuscle = Record<string, number>

/**
 * Hard sets per muscle group. A secondary muscle counts as half a set — the
 * convention most hypertrophy programming uses for fractional volume.
 */
export function volumeByMuscle(logs: WorkoutLog[], from: string, to: string): VolumeByMuscle {
  const out: VolumeByMuscle = {}
  for (const log of logs) {
    if (log.date < from || log.date > to) continue
    for (const ex of log.exercises) {
      const meta = getExercise(ex.exerciseId)
      if (!meta) continue
      const working = ex.sets.filter((s) => !s.warmup).length
      if (working === 0) continue
      for (const m of meta.primary) out[m] = (out[m] ?? 0) + working
      for (const m of meta.secondary) out[m] = (out[m] ?? 0) + working * 0.5
    }
  }
  return out
}

export function weekTonnage(logs: WorkoutLog[], from: string, to: string): number {
  return logs
    .filter((l) => l.date >= from && l.date <= to)
    .reduce((sum, l) => sum + l.exercises.reduce((s, ex) => s + sessionTonnage(ex.sets), 0), 0)
}

export const logTonnage = (log: WorkoutLog): number =>
  log.exercises.reduce((s, ex) => s + sessionTonnage(ex.sets), 0)

export const logSetCount = (log: WorkoutLog): number =>
  log.exercises.reduce((s, ex) => s + ex.sets.filter((x) => !x.warmup).length, 0)

/* ------------------------------- adherence ------------------------------ */

/** Consecutive completed sessions counting back from the most recent one. */
export function trainingStreak(program: Program, logs: WorkoutLog[], today = todayISO()): number {
  // Scoped to this block for the same reason `weekSchedule` is: the previous
  // block's ids are the same ids, and counting them made every new block open on
  // a streak the client had not earned.
  const done = new Set(logs.filter((l) => inBlock(program, l)).map((l) => l.sessionId))
  let streak = 0
  for (let w = currentWeekIndex(program, today); w >= 1; w--) {
    // Today's session is still ahead of them — it can't break a streak yet.
    const schedule = weekSchedule(program, w, logs).filter(
      (s) => s.date < today || (s.date === today && done.has(s.session.id)),
    )
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (done.has(schedule[i]!.session.id)) streak++
      else return streak
    }
  }
  return streak
}

export function sessionsThisWeek(
  program: Program,
  logs: WorkoutLog[],
  today = todayISO(),
): { done: number; total: number } {
  const schedule = weekSchedule(program, currentWeekIndex(program, today), logs)
  return { done: schedule.filter((s) => s.log).length, total: schedule.length }
}

/* ---------------------------- block resolution -------------------------- */

/** Prescription blocks with any client-side exercise swap applied. */
export function resolveBlockExercise(
  block: ExercisePrescription,
  swaps: Record<string, string>,
): string {
  return swaps[block.id] ?? block.exerciseId
}
