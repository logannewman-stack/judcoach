import type {
  ExercisePrescription,
  LoadSpec,
  Program,
  SessionTemplate,
  SetPrescription,
  WeekTemplate,
} from '../domain/types'
import { getExercise } from './exercises'
import { percentOf1RM } from '../domain/strength'

/* ============================================================================
   Jud's 8-week block, built from a compact spec.

   IDs are deterministic (`w3-lowerA-b0-s2`) because logged sets are keyed by
   prescription id — a random id would orphan a client's in-progress workout on
   every reload.
   ========================================================================== */

/**
 * A main-lift set is specified the way a coach actually writes one — reps and
 * an RPE — and the percentage is derived from the RPE chart. Hand-authoring
 * both let them drift apart: the ladder read as if the working max were a true
 * one-rep max while the app defined it as 90% of one, so every load ran ~10%
 * light and every RPE label was several points too hard for the weight.
 */
type MainSet = {
  reps: number
  /**
   * Target RPE. Omitted only where the chart cannot express the intent — a
   * deload sits below RPE 6, so claiming one would be a lie about the effort.
   */
  rpe?: number
  /** Fixed % of the working max, for sets that carry no RPE target. */
  pct?: number
  /** % of the heaviest working set already hit this session. */
  backoffPct?: number
  /** Autoregulated: work up until the RPE lands, rather than to a set load. */
  workUp?: boolean
  amrap?: boolean
  /** Upper bound on an AMRAP, so "5+" can't read as open-ended. */
  repsMax?: number
  note?: string
}

interface WeekSpec {
  label: string
  emphasis: string
  deload?: boolean
  main: MainSet[]
  secondaryRpe: number
  isolationRpe: number
  /** Accessory set count is trimmed on deload weeks. */
  volumeScale: number
  /** Rest between main-lift sets. Heavier weeks get longer. */
  mainRestSec: number
  notes: Partial<Record<SessionKey, string>>
}

type SessionKey = 'lowerA' | 'upperA' | 'lowerB' | 'upperB'

const WEEK_SPECS: WeekSpec[] = [
  {
    label: 'Accumulation',
    emphasis: 'Introduce the loads. Every set should feel like you had three more.',
    main: [
      { reps: 5, rpe: 7 },
      { reps: 5, rpe: 7 },
      { reps: 5, rpe: 7.5 },
      { reps: 5, rpe: 7.5 },
    ],
    mainRestSec: 180,
    secondaryRpe: 7,
    isolationRpe: 8,
    volumeScale: 1,
    notes: {
      lowerA: 'Week one is a rehearsal. If the bar speed slows, you went too heavy — trust the percentages.',
      upperA: 'Film your top set from the side. I want to see the bar path.',
    },
  },
  {
    label: 'Accumulation',
    emphasis: 'Same movements, a little more load. Hold the technique.',
    main: [
      { reps: 5, rpe: 7.5 },
      { reps: 5, rpe: 8 },
      { reps: 5, rpe: 8 },
      { reps: 5, rpe: 8 },
    ],
    mainRestSec: 195,
    secondaryRpe: 8,
    isolationRpe: 8.5,
    volumeScale: 1,
    notes: {
      lowerB: 'Reset your brace between every deadlift rep. No touch-and-go.',
      upperB: 'Add a rep to the accessories before you add weight.',
    },
  },
  {
    label: 'Overreach',
    emphasis: 'The hardest week of the block. Expect to feel it — that is the point.',
    main: [
      { reps: 5, rpe: 8 },
      { reps: 5, rpe: 8 },
      { reps: 5, rpe: 8.5 },
      { reps: 5, rpe: 8.5 },
      {
        reps: 5,
        rpe: 9,
        amrap: true,
        repsMax: 8,
        note: 'Last set: as many as you can with one rep left in the tank. Stop at eight.',
      },
    ],
    mainRestSec: 210,
    secondaryRpe: 8.5,
    isolationRpe: 9,
    volumeScale: 1.15,
    notes: {
      lowerA: 'Heaviest squat week so far. Sleep is part of the programme this week.',
      upperA: 'Push the AMRAP but stop at one rep in reserve — no grinders.',
    },
  },
  {
    label: 'Deload',
    emphasis: 'Two-thirds the load, half the volume. Let the work catch up with you.',
    deload: true,
    // A deload is quieter than RPE 6, the chart's floor, so it prescribes a
    // load and makes no claim about how hard it should feel.
    main: [
      { reps: 5, pct: 62 },
      { reps: 5, pct: 65 },
      { reps: 5, pct: 65 },
    ],
    mainRestSec: 150,
    secondaryRpe: 6.5,
    isolationRpe: 7,
    volumeScale: 0.6,
    notes: {
      lowerA: 'Bar speed is the whole goal. If it feels heavy, drop it further.',
      lowerB: 'Deload weeks are where the adaptation actually shows up. Do not add sets.',
    },
  },
  {
    label: 'Intensification',
    emphasis: 'Fewer reps, heavier bar. Sharpen up.',
    main: [
      { reps: 4, rpe: 8 },
      { reps: 3, rpe: 8 },
      { reps: 4, rpe: 8 },
      { reps: 4, rpe: 8.5 },
    ],
    mainRestSec: 210,
    secondaryRpe: 8,
    isolationRpe: 8.5,
    volumeScale: 0.95,
    notes: {
      upperA: 'Pause every bench rep on the chest. Heavier bar, same standard.',
      lowerB: 'Singles-speed intent on every rep, even at four reps.',
    },
  },
  {
    label: 'Intensification',
    emphasis: 'Top set is real work now. Back-offs stay crisp.',
    main: [
      { reps: 3, rpe: 8 },
      { reps: 3, rpe: 8.5 },
      { reps: 3, backoffPct: 88, rpe: 8 },
      { reps: 3, backoffPct: 88, rpe: 9, amrap: true, repsMax: 6, note: 'Optional AMRAP — stop at RPE 9.' },
    ],
    mainRestSec: 225,
    secondaryRpe: 8.5,
    isolationRpe: 9,
    volumeScale: 0.95,
    notes: {
      lowerA: 'If the third rep slows down more than 20%, that is your set. Cut it.',
      upperB: 'Strict press. The moment the knees bend, the set is over.',
    },
  },
  {
    label: 'Peak',
    emphasis: 'Heaviest loads of the block. Long rests, full focus.',
    main: [
      { reps: 2, rpe: 8 },
      { reps: 2, rpe: 9 },
      { reps: 4, backoffPct: 82, rpe: 8 },
      { reps: 4, backoffPct: 82, rpe: 8.5 },
    ],
    mainRestSec: 270,
    secondaryRpe: 8,
    isolationRpe: 8.5,
    volumeScale: 0.85,
    notes: {
      lowerA: 'Four to five minutes between the heavy doubles. Do not rush this.',
      upperA: 'Have a spotter for the 92% double. Every time.',
      lowerB: 'If the second double is a grinder, skip the third. Nothing to prove in week seven.',
    },
  },
  {
    label: 'Test & Reset',
    emphasis: 'Work up to a true top single, then shut it down.',
    main: [
      { reps: 3, rpe: 7, note: 'Opener — should fly.' },
      { reps: 1, rpe: 8, note: 'Second attempt feel.' },
      { reps: 1, workUp: true, rpe: 9, note: 'Top single. Stop the moment it turns into a grind.' },
      { reps: 5, backoffPct: 70, rpe: 7 },
    ],
    mainRestSec: 270,
    secondaryRpe: 7,
    isolationRpe: 8,
    volumeScale: 0.55,
    notes: {
      lowerA: 'New training max = your top single × 0.9. I will update it after you log this.',
      upperB: 'Finish the block, then take three full days off before block four.',
    },
  },
]

/* ---------------------------- session skeletons ------------------------- */

interface AccessorySpec {
  exerciseId: string
  sets: number
  reps: number
  repsMax?: number
  /** 'secondary' tracks the week's compound RPE, 'isolation' the higher one. */
  intensity: 'secondary' | 'isolation'
  restSec?: number
  tempo?: string
  note?: string
  supersetGroup?: string
  load?: LoadSpec
}

interface SessionSkeleton {
  key: SessionKey
  name: string
  focus: string
  weekday: number
  estMinutes: number
  mainLiftId: string
  accessories: AccessorySpec[]
}

const SESSIONS: SessionSkeleton[] = [
  {
    key: 'lowerA',
    name: 'Lower A',
    focus: 'Squat · Quads · Posterior chain',
    weekday: 1,
    estMinutes: 68,
    mainLiftId: 'back-squat',
    accessories: [
      { exerciseId: 'rdl', sets: 3, reps: 8, intensity: 'secondary', restSec: 150, tempo: '3-0-1' },
      { exerciseId: 'bulgarian-split-squat', sets: 3, reps: 10, intensity: 'secondary', restSec: 120, note: 'Per leg. Torso tall.' },
      { exerciseId: 'seated-leg-curl', sets: 3, reps: 12, repsMax: 15, intensity: 'isolation', restSec: 75, supersetGroup: 'A' },
      { exerciseId: 'standing-calf-raise', sets: 4, reps: 12, intensity: 'isolation', restSec: 75, supersetGroup: 'A', tempo: '2-1-2' },
      { exerciseId: 'hanging-leg-raise', sets: 3, reps: 12, intensity: 'isolation', restSec: 75, load: { kind: 'bodyweight' } },
    ],
  },
  {
    key: 'upperA',
    name: 'Upper A',
    focus: 'Bench · Chest · Vertical pull',
    weekday: 2,
    estMinutes: 64,
    mainLiftId: 'bench-press',
    accessories: [
      { exerciseId: 'weighted-pullup', sets: 4, reps: 6, repsMax: 8, intensity: 'secondary', restSec: 150 },
      { exerciseId: 'incline-db-press', sets: 3, reps: 10, repsMax: 12, intensity: 'secondary', restSec: 120 },
      { exerciseId: 'chest-supported-row', sets: 3, reps: 12, intensity: 'isolation', restSec: 105 },
      { exerciseId: 'lateral-raise', sets: 4, reps: 15, intensity: 'isolation', restSec: 60, supersetGroup: 'B' },
      { exerciseId: 'triceps-pushdown', sets: 3, reps: 12, repsMax: 15, intensity: 'isolation', restSec: 60, supersetGroup: 'B' },
    ],
  },
  {
    key: 'lowerB',
    name: 'Lower B',
    focus: 'Deadlift · Hips · Unilateral',
    weekday: 4,
    estMinutes: 70,
    mainLiftId: 'deadlift',
    accessories: [
      { exerciseId: 'front-squat', sets: 3, reps: 6, intensity: 'secondary', restSec: 180 },
      { exerciseId: 'hip-thrust', sets: 3, reps: 10, intensity: 'secondary', restSec: 120, tempo: '1-1-2' },
      { exerciseId: 'walking-lunge', sets: 2, reps: 12, intensity: 'isolation', restSec: 105, note: 'Per leg.' },
      { exerciseId: 'seated-calf-raise', sets: 4, reps: 15, intensity: 'isolation', restSec: 75 },
      { exerciseId: 'pallof-press', sets: 3, reps: 12, intensity: 'isolation', restSec: 60, note: 'Per side. Five-second holds.' },
    ],
  },
  {
    key: 'upperB',
    name: 'Upper B',
    focus: 'Overhead press · Back thickness · Arms',
    weekday: 5,
    estMinutes: 62,
    mainLiftId: 'overhead-press',
    accessories: [
      { exerciseId: 'barbell-row', sets: 4, reps: 8, intensity: 'secondary', restSec: 150 },
      { exerciseId: 'dips', sets: 3, reps: 8, repsMax: 10, intensity: 'secondary', restSec: 150 },
      { exerciseId: 'lat-pulldown', sets: 3, reps: 12, intensity: 'isolation', restSec: 105 },
      { exerciseId: 'rear-delt-fly', sets: 3, reps: 15, intensity: 'isolation', restSec: 60, supersetGroup: 'C' },
      { exerciseId: 'db-curl', sets: 3, reps: 10, repsMax: 12, intensity: 'isolation', restSec: 60, supersetGroup: 'C' },
    ],
  },
]

/* -------------------------------- builder ------------------------------- */

function mainLoad(set: MainSet): LoadSpec {
  if (set.backoffPct != null) return { kind: 'backoff', pctOfTop: set.backoffPct }
  if (set.workUp) return { kind: 'rpe' }
  if (set.pct != null) return { kind: 'percent', value: set.pct }
  // Percentage and RPE come from the same place, so they cannot disagree.
  return { kind: 'percent', value: Math.round(percentOf1RM(set.reps, set.rpe!) * 10) / 10 }
}

function buildMainBlock(skeleton: SessionSkeleton, spec: WeekSpec, weekIndex: number): ExercisePrescription {
  const rest = spec.mainRestSec
  const sets: SetPrescription[] = spec.main.map((s, i) => ({
    id: `w${weekIndex}-${skeleton.key}-b0-s${i}`,
    reps: s.reps,
    repsMax: s.repsMax,
    amrap: s.amrap,
    load: mainLoad(s),
    rpe: s.rpe,
    restSec: s.workUp ? rest + 60 : rest,
    note: s.note,
  }))
  return {
    id: `w${weekIndex}-${skeleton.key}-b0`,
    exerciseId: skeleton.mainLiftId,
    sets,
    note: spec.deload ? 'Deload — bar speed over bar weight.' : undefined,
  }
}

function buildAccessoryBlock(
  acc: AccessorySpec,
  skeleton: SessionSkeleton,
  spec: WeekSpec,
  weekIndex: number,
  blockIndex: number,
): ExercisePrescription {
  const exercise = getExercise(acc.exerciseId)
  const rpe = acc.intensity === 'secondary' ? spec.secondaryRpe : spec.isolationRpe
  const setCount = Math.max(2, Math.round(acc.sets * spec.volumeScale))
  const rest = acc.restSec ?? exercise?.defaultRestSec ?? 90
  const sets: SetPrescription[] = Array.from({ length: setCount }, (_, i) => ({
    id: `w${weekIndex}-${skeleton.key}-b${blockIndex}-s${i}`,
    reps: acc.reps,
    repsMax: acc.repsMax,
    load: acc.load ?? { kind: 'rpe' },
    // Last set of an isolation movement is pushed a half point harder.
    rpe: acc.intensity === 'isolation' && i === setCount - 1 ? Math.min(10, rpe + 0.5) : rpe,
    restSec: rest,
    tempo: acc.tempo,
  }))
  return {
    id: `w${weekIndex}-${skeleton.key}-b${blockIndex}`,
    exerciseId: acc.exerciseId,
    sets,
    note: acc.note,
    supersetGroup: acc.supersetGroup,
  }
}

function buildSession(skeleton: SessionSkeleton, spec: WeekSpec, weekIndex: number): SessionTemplate {
  const blocks: ExercisePrescription[] = [
    buildMainBlock(skeleton, spec, weekIndex),
    ...skeleton.accessories.map((acc, i) => buildAccessoryBlock(acc, skeleton, spec, weekIndex, i + 1)),
  ]
  const estMinutes = Math.round(skeleton.estMinutes * (spec.deload ? 0.75 : 1))
  return {
    id: `w${weekIndex}-${skeleton.key}`,
    name: skeleton.name,
    focus: skeleton.focus,
    weekday: skeleton.weekday,
    estMinutes,
    coachNote: spec.notes[skeleton.key],
    blocks,
  }
}

export function buildProgram(startDate: string): Program {
  const weeks: WeekTemplate[] = WEEK_SPECS.map((spec, i) => {
    const index = i + 1
    return {
      id: `week-${index}`,
      index,
      label: `Week ${index} — ${spec.label}`,
      emphasis: spec.emphasis,
      deload: spec.deload,
      sessions: SESSIONS.map((s) => buildSession(s, spec, index)),
    }
  })

  return {
    id: 'block-3-strength-hypertrophy',
    name: 'Block 3 · Strength + Size',
    subtitle: '8 weeks · 4 days · upper/lower',
    goal: 'Add 20 lb across the big three while gaining at 0.4 lb a week — strength up, waist flat.',
    coach: 'Jud',
    startDate,
    daysPerWeek: 4,
    weeks,
  }
}

const programCache = new Map<string, Program>()

/** Memoised so every consumer shares one programme object per start date. */
export function getProgram(startDate: string): Program {
  let program = programCache.get(startDate)
  if (!program) {
    program = buildProgram(startDate)
    programCache.set(startDate, program)
  }
  return program
}
