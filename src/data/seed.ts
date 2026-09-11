import type {
  CheckIn, LoggedExercise, LoggedSet, MeasurementEntry, Profile, Settings,
  WeighIn, WorkoutLog,
} from '../domain/types'
import { buildProgram } from './program'
import { DEFAULT_PLATES_LB, resolveSet, roundToIncrement, topSet } from '../domain/strength'
import { addDays, startOfWeek, todayISO } from '../lib/date'

/* --------------------------- deterministic noise ------------------------- */

/** Mulberry32 — same seed, same demo data, every launch. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* -------------------------------- profile ------------------------------- */

/**
 * Which block of Jud's the sample client is on. The seed's whole story is that
 * they are mid-programme — five weeks in, with three blocks of history behind
 * them — so it is 3 here and 1 for anyone starting fresh.
 */
export const SEED_BLOCK_NUMBER = 3

export const SEED_PROFILE: Profile = {
  name: 'Alex Rivera',
  goalLabel: 'Lean gain · 0.4 lb / week',
  units: 'lb',
  heightIn: 71,
  birthYear: 1994,
  sex: 'male',
  startWeight: 181.6,
  goalWeight: 192,
  weeklyRateTarget: 0.4,
  trainingMaxes: {
    'back-squat': 385,
    'bench-press': 275,
    deadlift: 465,
    'overhead-press': 165,
  },
  barWeight: 45,
  availablePlates: DEFAULT_PLATES_LB,
  roundingIncrement: 5,
}

export const SEED_SETTINGS: Settings = {
  theme: 'system',
  accent: 'blue',
  haptics: true,
  restTimerAuto: true,
  restTimerSound: false,
  showRir: true,
  showPlateMath: true,
  keepAwake: true,
  weightUnitDecimals: 1,
  firstDayOfWeek: 1,
  notifications: {
    workoutReminder: true,
    weighInReminder: true,
    mealReminder: false,
    coachMessages: true,
  },
}

/**
 * The block started four weeks before the current week, so a fresh install
 * opens mid-programme with real history behind it.
 */
export function seedStartDate(today = todayISO()): string {
  return addDays(startOfWeek(today, 1), -28)
}

/* ------------------------------- weigh-ins ------------------------------ */

export function seedWeighIns(today = todayISO()): WeighIn[] {
  const rand = rng(20260910)
  const days = 74
  const out: WeighIn[] = []
  let drift = 0
  for (let i = days; i >= 0; i--) {
    const date = addDays(today, -i)
    const elapsed = days - i
    // Trend: +0.05 lb/day, plus a slow water-weight wobble and daily noise.
    drift = drift * 0.55 + (rand() - 0.5) * 1.5
    const wave = Math.sin(elapsed / 5.5) * 0.5
    const weight = SEED_PROFILE.startWeight + elapsed * 0.05 + drift + wave
    // Real clients miss days — ~14% of them, but never today.
    if (i !== 0 && rand() < 0.14) continue
    out.push({ date, weight: Math.round(weight * 10) / 10 })
  }
  return out
}

export function seedMeasurements(today = todayISO()): MeasurementEntry[] {
  const points = [56, 42, 28, 14, 0]
  const rand = rng(77123)
  return points.map((back, i) => ({
    date: addDays(today, -back),
    waist: Math.round((33.2 + i * 0.08 + (rand() - 0.5) * 0.2) * 10) / 10,
    chest: Math.round((43.1 + i * 0.22 + (rand() - 0.5) * 0.2) * 10) / 10,
    arm: Math.round((15.4 + i * 0.09 + (rand() - 0.5) * 0.1) * 10) / 10,
    thigh: Math.round((24.1 + i * 0.14 + (rand() - 0.5) * 0.15) * 10) / 10,
    hips: Math.round((39.4 + i * 0.05 + (rand() - 0.5) * 0.2) * 10) / 10,
  }))
}

/* ------------------------------- check-ins ------------------------------ */

export function seedCheckIns(today = todayISO()): CheckIn[] {
  const notes = [
    {
      note: 'Squats felt heavy on Monday but everything else moved well. Sleep has been short — kid was sick.',
      reply: 'Noted. Keep the top set at RPE 8 this week and do not chase the back-offs. Sleep first, PRs later.',
      sleep: 2, energy: 3, soreness: 3, adherence: 88,
    },
    {
      note: 'Big week. AMRAP on bench got 9 reps at 205 which felt like a real 8.',
      reply: 'Nine at 205 puts your e1RM at 267 — that is +12 lb in three weeks. Deload next week, no negotiating.',
      sleep: 4, energy: 4, soreness: 2, adherence: 95,
    },
    {
      note: 'Deload week. Felt weirdly antsy but stuck to it. Waist measurement is holding.',
      reply: 'That antsy feeling is exactly why deloads work. Week 5 you go heavier — you will be glad you held back.',
      sleep: 4, energy: 5, soreness: 1, adherence: 97,
    },
  ]
  return notes.map((n, i) => ({
    id: `checkin-${i}`,
    date: addDays(today, -21 + i * 7),
    weight: 183.4 + i * 0.4,
    sleepQuality: n.sleep,
    energy: n.energy,
    soreness: n.soreness,
    adherence: n.adherence,
    note: n.note,
    coachReply: n.reply,
  }))
}

/* ----------------------------- workout history --------------------------- */

/** Week-1 working loads for the accessory movements, in lb. */
const ACCESSORY_BASE: Record<string, number> = {
  rdl: 205,
  'bulgarian-split-squat': 50,
  'seated-leg-curl': 110,
  'standing-calf-raise': 180,
  'hanging-leg-raise': 0,
  'weighted-pullup': 35,
  'incline-db-press': 70,
  'chest-supported-row': 140,
  'lateral-raise': 20,
  'triceps-pushdown': 60,
  'front-squat': 205,
  'hip-thrust': 275,
  'walking-lunge': 45,
  'seated-calf-raise': 115,
  'pallof-press': 40,
  'barbell-row': 185,
  dips: 45,
  'lat-pulldown': 155,
  'rear-delt-fly': 65,
  'db-curl': 35,
}

function accessoryLoad(exerciseId: string, weekIndex: number, deload: boolean, jitter: number): number {
  const base = ACCESSORY_BASE[exerciseId] ?? 0
  if (base === 0) return 0
  const progression = 1 + (weekIndex - 1) * 0.022
  const scale = deload ? 0.82 : 1
  const raw = base * progression * scale * (1 + jitter)
  const increment = base < 60 ? 2.5 : 5
  return roundToIncrement(raw, increment)
}

/**
 * Replay the programme's past weeks as if the client had trained them, so the
 * charts, PR history and "last time" anchors all have real data behind them.
 */
export function seedWorkoutLogs(today = todayISO(), startDate = seedStartDate(today)): WorkoutLog[] {
  const program = buildProgram(startDate, SEED_BLOCK_NUMBER)
  const rand = rng(4242)
  const logs: WorkoutLog[] = []

  for (const week of program.weeks) {
    const weekStart = addDays(startDate, (week.index - 1) * 7)
    for (const session of week.sessions) {
      // Templates use 0=Sunday; the block runs Monday-first.
      const offset = (session.weekday + 6) % 7
      const date = addDays(weekStart, offset)
      if (date >= today) continue
      // Missed sessions happen — about one in fourteen.
      if (rand() < 0.07) continue

      const exercises: LoggedExercise[] = []
      const startedAt = `${date}T17:35:00`
      let secondsIn = 0

      for (const block of session.blocks) {
        const sets: LoggedSet[] = []
        for (const [i, prescription] of block.sets.entries()) {
          const resolved = resolveSet(prescription, {
            trainingMax: SEED_PROFILE.trainingMaxes[block.exerciseId],
            profile: SEED_PROFILE,
            topSetWeight: topSet(sets)?.weight,
          })
          const jitter = (rand() - 0.5) * 0.05
          const weight =
            resolved.targetWeight ?? accessoryLoad(block.exerciseId, week.index, !!week.deload, jitter)

          // Reps land on target, and a rare hard set comes up one short.
          //
          // An AMRAP beats its minimum but is still a prescription: `repsMax` is
          // where Jud's own note tells the client to stop, so the replayed set
          // stops there too. Running past it logged ten deadlifts under a note
          // reading "Stop at eight", and the e1RM off that set then dragged the
          // PR board and the suggested working max up with it.
          let reps = prescription.reps
          if (prescription.amrap) {
            const cap = Math.max(prescription.reps + 1, prescription.repsMax ?? prescription.reps + 4)
            reps = prescription.reps + 1 + Math.floor(rand() * (cap - prescription.reps))
          } else if (rand() < 0.06 && (prescription.rpe ?? 0) >= 8.5) reps = Math.max(1, reps - 1)

          const targetRpe = prescription.rpe ?? 8
          const rpe = Math.min(10, Math.max(6, Math.round((targetRpe + (rand() - 0.45)) * 2) / 2))

          sets.push({
            id: `${session.id}-${block.id}-${i}`,
            prescriptionId: prescription.id,
            weight,
            reps,
            rpe,
            completedAt: `${date}T${String(17 + Math.floor(secondsIn / 3600)).padStart(2, '0')}:${String(
              Math.floor((secondsIn % 3600) / 60) + 35,
            ).padStart(2, '0')}:00`,
          })
          secondsIn += (prescription.restSec ?? 120) + 45
        }
        exercises.push({ exerciseId: block.exerciseId, prescriptionId: block.id, sets })
      }

      const durationSec = Math.round(session.estMinutes * 60 * (0.9 + rand() * 0.25))
      logs.push({
        id: `log-${session.id}`,
        date,
        weekIndex: week.index,
        sessionId: session.id,
        sessionName: session.name,
        startedAt,
        finishedAt: `${date}T18:45:00`,
        durationSec,
        exercises,
        sessionRpe: Math.round((7 + rand() * 2) * 2) / 2,
      })
    }
  }
  return logs
}

export const COACH = {
  name: 'Jud',
  fullName: 'Jud Whitfield',
  title: 'Strength & Physique Coach',
  credentials: 'CSCS · Pn1',
  email: 'jud@judcoach.app',
  bio:
    'Fourteen years coaching lifters from first-ever squat to national platform. '
    + 'The programme is simple: percentages set the floor, RPE sets the ceiling, and '
    + 'the check-in decides what happens next week.',
  responseWindow: 'Replies within 24 hours, Mon–Sat',
}
