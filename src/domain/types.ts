/* ============================================================================
   Domain model
   ========================================================================== */

export type Units = 'lb' | 'kg'
export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentKey = 'blue' | 'indigo' | 'green' | 'orange' | 'pink' | 'purple'

/* ------------------------------- exercises ------------------------------ */

export type MuscleGroup =
  | 'chest' | 'back' | 'lats' | 'quads' | 'hamstrings' | 'glutes' | 'shoulders'
  | 'biceps' | 'triceps' | 'calves' | 'core' | 'forearms' | 'traps' | 'adductors'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell'
  | 'band' | 'smith' | 'ez-bar' | 'trap-bar'

export type MovementPattern =
  | 'squat' | 'hinge' | 'push-horizontal' | 'push-vertical' | 'pull-horizontal'
  | 'pull-vertical' | 'lunge' | 'carry' | 'isolation' | 'core'

export interface Exercise {
  id: string
  name: string
  shortName?: string
  equipment: Equipment
  pattern: MovementPattern
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
  /** Main lifts carry a training max and drive percentage-based loading. */
  isMainLift?: boolean
  /** Loaded on a bar with plates on each side — enables the plate calculator. */
  barLoaded?: boolean
  unilateral?: boolean
  defaultRestSec: number
  cues: string[]
  setup?: string[]
  substituteIds?: string[]
}

/* ------------------------------ programming ----------------------------- */

export type LoadSpec =
  /** Percentage of the lift's training max. */
  | { kind: 'percent'; value: number }
  /** Work up to a given RPE at the prescribed reps — load is autoregulated. */
  | { kind: 'rpe' }
  /** A fixed absolute load. */
  | { kind: 'weight'; value: number }
  /** Percentage of the heaviest working set logged earlier this session. */
  | { kind: 'backoff'; pctOfTop: number }
  | { kind: 'bodyweight' }

export interface SetPrescription {
  id: string
  reps: number
  /** Upper bound when the coach prescribes a rep range (e.g. 8–12). */
  repsMax?: number
  /** As many reps as possible — the last rep should land on the target RPE. */
  amrap?: boolean
  load: LoadSpec
  /** Target RPE (6–10, half-point steps). RIR is derived as 10 − RPE. */
  rpe?: number
  restSec?: number
  tempo?: string
  note?: string
}

export interface ExercisePrescription {
  id: string
  exerciseId: string
  sets: SetPrescription[]
  note?: string
  /** Exercises sharing a group letter are performed as a superset. */
  supersetGroup?: string
}

export interface SessionTemplate {
  id: string
  name: string
  focus: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  estMinutes: number
  coachNote?: string
  blocks: ExercisePrescription[]
}

export interface WeekTemplate {
  id: string
  index: number
  label: string
  emphasis: string
  deload?: boolean
  sessions: SessionTemplate[]
}

export interface Program {
  id: string
  name: string
  subtitle: string
  goal: string
  coach: string
  /** ISO date (yyyy-mm-dd) of week 1, day 1. */
  startDate: string
  daysPerWeek: number
  weeks: WeekTemplate[]
}

/* -------------------------------- logging ------------------------------- */

export interface LoggedSet {
  id: string
  prescriptionId?: string
  weight: number
  reps: number
  rpe?: number
  completedAt: string
  warmup?: boolean
}

export interface LoggedExercise {
  exerciseId: string
  prescriptionId?: string
  sets: LoggedSet[]
  note?: string
  /** Set when the client swapped in a different movement. */
  swappedFromId?: string
}

export interface WorkoutLog {
  id: string
  /** ISO date (yyyy-mm-dd). */
  date: string
  weekIndex: number
  sessionId: string
  sessionName: string
  startedAt: string
  finishedAt?: string
  durationSec?: number
  exercises: LoggedExercise[]
  sessionRpe?: number
  notes?: string
}

/** In-flight session state, persisted so a reload never loses a workout. */
export interface ActiveSession {
  logId: string
  weekIndex: number
  sessionId: string
  startedAt: string
  /** prescriptionId -> the sets logged against it so far. */
  entries: Record<string, LoggedSet[]>
  /** prescriptionId -> exercise substituted in for the prescribed one. */
  swaps: Record<string, string>
  notes: Record<string, string>
  /** prescriptionId -> how many warm-up rungs have been ticked off. */
  warmups: Record<string, number>
  currentBlockIndex: number
}

export interface RestTimer {
  endsAt: number
  totalSec: number
  label: string
}

/* -------------------------------- weigh-in ------------------------------ */

export interface WeighIn {
  date: string
  weight: number
  note?: string
}

export interface MeasurementEntry {
  date: string
  waist?: number
  chest?: number
  hips?: number
  arm?: number
  thigh?: number
  neck?: number
  bodyFat?: number
}

export type PhotoPose = 'front' | 'side' | 'back'

export interface ProgressPhoto {
  id: string
  date: string
  pose: PhotoPose
  dataUrl: string
}

/* ------------------------------- nutrition ------------------------------ */

export interface MacroTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  waterOz: number
}

export interface FoodItem {
  id: string
  name: string
  qty: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** Macro-matched alternatives the client can swap in. */
  swaps?: Omit<FoodItem, 'swaps'>[]
}

export interface Meal {
  id: string
  name: string
  time: string
  note?: string
  items: FoodItem[]
}

export interface MealPlan {
  id: string
  name: string
  subtitle: string
  targets: MacroTargets
  /** Training-day / rest-day macro split. */
  restDayTargets?: MacroTargets
  meals: Meal[]
  guidelines: string[]
}

export interface DayNutrition {
  date: string
  /** Keyed by food item id. */
  checked: Record<string, boolean>
  waterOz: number
  extras: FoodItem[]
  skippedMeals: string[]
}

/* -------------------------------- profile ------------------------------- */

export interface CheckIn {
  id: string
  date: string
  weight: number
  sleepQuality: number
  energy: number
  soreness: number
  adherence: number
  note?: string
  coachReply?: string
}

export interface Profile {
  name: string
  goalLabel: string
  units: Units
  heightIn: number
  birthYear: number
  sex: 'male' | 'female'
  goalWeight: number
  startWeight: number
  /** exerciseId -> training max in the user's units. */
  trainingMaxes: Record<string, number>
  /** Bar weight + the plate pairs actually available at their gym. */
  barWeight: number
  availablePlates: number[]
  roundingIncrement: number
  weeklyRateTarget: number
}

export interface Settings {
  theme: ThemeMode
  accent: AccentKey
  haptics: boolean
  restTimerAuto: boolean
  restTimerSound: boolean
  showRir: boolean
  showPlateMath: boolean
  keepAwake: boolean
  weightUnitDecimals: number
  firstDayOfWeek: 0 | 1
  notifications: {
    workoutReminder: boolean
    weighInReminder: boolean
    mealReminder: boolean
    coachMessages: boolean
  }
}
