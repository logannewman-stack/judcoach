import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveSession, CheckIn, DayNutrition, FoodItem, LoggedSet, MeasurementEntry,
  Profile, ProgressPhoto, RestTimer, Settings, WeighIn, WorkoutLog,
} from '../domain/types'
import {
  SEED_PROFILE, SEED_SETTINGS, seedCheckIns, seedMeasurements, seedStartDate,
  seedWeighIns, seedWorkoutLogs,
} from '../data/seed'
import { getProgram } from '../data/program'
import { startOfWeek, todayISO } from '../lib/date'
import { uid } from '../lib/id'

export interface AppState {
  /* ------------------------------- data ------------------------------- */
  profile: Profile
  settings: Settings
  /** The programme is rebuilt from this date, not stored set-by-set. */
  programStartDate: string
  weighIns: WeighIn[]
  measurements: MeasurementEntry[]
  photos: ProgressPhoto[]
  logs: WorkoutLog[]
  checkIns: CheckIn[]
  /** Keyed by ISO date; only days the client has touched are stored. */
  nutrition: Record<string, DayNutrition>
  active: ActiveSession | null
  restTimer: RestTimer | null
  /** Bumped whenever demo data is regenerated, to force chart remounts. */
  seededAt: string
  /** False until the client has been through the welcome flow. */
  onboarded: boolean

  /* ------------------------------ profile ----------------------------- */
  completeOnboarding: () => void
  startFresh: () => void
  updateProfile: (patch: Partial<Profile>) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTrainingMax: (exerciseId: string, value: number) => void

  /* ----------------------------- weigh-ins ---------------------------- */
  saveWeighIn: (entry: WeighIn) => void
  deleteWeighIn: (date: string) => void
  saveMeasurement: (entry: MeasurementEntry) => void
  addPhoto: (photo: ProgressPhoto) => void
  deletePhoto: (id: string) => void
  addCheckIn: (entry: Omit<CheckIn, 'id'>) => void

  /* ------------------------------ training ---------------------------- */
  startSession: (weekIndex: number, sessionId: string) => void
  setCurrentBlock: (index: number) => void
  logSet: (prescriptionId: string, set: Omit<LoggedSet, 'id' | 'completedAt'>) => void
  updateLoggedSet: (prescriptionId: string, setId: string, patch: Partial<LoggedSet>) => void
  removeLoggedSet: (prescriptionId: string, setId: string) => void
  swapExercise: (prescriptionId: string, exerciseId: string) => void
  setBlockNote: (prescriptionId: string, note: string) => void
  setWarmupsDone: (prescriptionId: string, count: number) => void
  finishSession: (meta: { sessionName: string; sessionRpe?: number; notes?: string }) => void
  discardSession: () => void

  /* ---------------------------- rest timer ---------------------------- */
  startRest: (seconds: number, label: string) => void
  adjustRest: (deltaSeconds: number) => void
  stopRest: () => void

  /* ----------------------------- nutrition ---------------------------- */
  toggleFood: (date: string, foodId: string) => void
  setMealSkipped: (date: string, mealId: string, skipped: boolean) => void
  setWater: (date: string, oz: number) => void
  setPortion: (date: string, foodId: string, multiplier: number) => void
  addExtraFood: (date: string, food: Omit<FoodItem, 'id'>) => void
  removeExtraFood: (date: string, foodId: string) => void
  checkAllInMeal: (date: string, foodIds: string[], checked: boolean) => void

  /* -------------------------------- data ------------------------------ */
  resetToSeed: () => void
  clearAllData: () => void
  importState: (raw: unknown) => boolean
}

export const emptyDay = (date: string): DayNutrition => ({
  date,
  checked: {},
  portions: {},
  waterOz: 0,
  extras: [],
  skippedMeals: [],
})

function seedState() {
  const today = todayISO()
  const startDate = seedStartDate(today)
  return {
    profile: SEED_PROFILE,
    settings: SEED_SETTINGS,
    programStartDate: startDate,
    weighIns: seedWeighIns(today),
    measurements: seedMeasurements(today),
    photos: [] as ProgressPhoto[],
    logs: seedWorkoutLogs(today, startDate),
    checkIns: seedCheckIns(today),
    nutrition: {} as Record<string, DayNutrition>,
    active: null,
    restTimer: null,
    seededAt: new Date().toISOString(),
    onboarded: false,
  }
}

/** Mutate one day's nutrition record, creating it on first touch. */
function withDay(
  state: AppState,
  date: string,
  fn: (day: DayNutrition) => DayNutrition,
): Pick<AppState, 'nutrition'> {
  const current = state.nutrition[date] ?? emptyDay(date)
  return { nutrition: { ...state.nutrition, [date]: fn(current) } }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),

      completeOnboarding: () => set(() => ({ onboarded: true })),

      /**
       * Clear the sample client out and restart the block from this week, so a
       * real client begins at week one on an empty history rather than dropping
       * into the middle of someone else's programme.
       */
      startFresh: () =>
        set((s) => ({
          weighIns: [],
          measurements: [],
          photos: [],
          logs: [],
          checkIns: [],
          nutrition: {},
          active: null,
          restTimer: null,
          programStartDate: startOfWeek(todayISO(), 1),
          profile: { ...s.profile, name: '' },
        })),

      /* ------------------------------ profile --------------------------- */
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setTrainingMax: (exerciseId, value) =>
        set((s) => ({
          profile: {
            ...s.profile,
            trainingMaxes: { ...s.profile.trainingMaxes, [exerciseId]: value },
          },
        })),

      /* ----------------------------- weigh-ins -------------------------- */
      saveWeighIn: (entry) =>
        set((s) => {
          const rest = s.weighIns.filter((w) => w.date !== entry.date)
          return { weighIns: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)) }
        }),
      deleteWeighIn: (date) => set((s) => ({ weighIns: s.weighIns.filter((w) => w.date !== date) })),
      saveMeasurement: (entry) =>
        set((s) => {
          const rest = s.measurements.filter((m) => m.date !== entry.date)
          return { measurements: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)) }
        }),
      addPhoto: (photo) => set((s) => ({ photos: [photo, ...s.photos] })),
      deletePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
      addCheckIn: (entry) =>
        set((s) => ({ checkIns: [...s.checkIns, { ...entry, id: uid('checkin') }] })),

      /* ------------------------------ training -------------------------- */
      startSession: (weekIndex, sessionId) =>
        set(() => ({
          active: {
            logId: uid('log'),
            weekIndex,
            sessionId,
            startedAt: new Date().toISOString(),
            entries: {},
            swaps: {},
            notes: {},
            warmups: {},
            currentBlockIndex: 0,
          },
        })),

      setCurrentBlock: (index) =>
        set((s) => (s.active ? { active: { ...s.active, currentBlockIndex: index } } : {})),

      logSet: (prescriptionId, entry) =>
        set((s) => {
          if (!s.active) return {}
          const existing = s.active.entries[prescriptionId] ?? []
          const logged: LoggedSet = {
            ...entry,
            id: uid('set'),
            completedAt: new Date().toISOString(),
          }
          return {
            active: {
              ...s.active,
              entries: { ...s.active.entries, [prescriptionId]: [...existing, logged] },
            },
          }
        }),

      updateLoggedSet: (prescriptionId, setId, patch) =>
        set((s) => {
          if (!s.active) return {}
          const sets = s.active.entries[prescriptionId] ?? []
          return {
            active: {
              ...s.active,
              entries: {
                ...s.active.entries,
                [prescriptionId]: sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)),
              },
            },
          }
        }),

      removeLoggedSet: (prescriptionId, setId) =>
        set((s) => {
          if (!s.active) return {}
          const sets = s.active.entries[prescriptionId] ?? []
          return {
            active: {
              ...s.active,
              entries: {
                ...s.active.entries,
                [prescriptionId]: sets.filter((x) => x.id !== setId),
              },
            },
          }
        }),

      swapExercise: (prescriptionId, exerciseId) =>
        set((s) =>
          s.active
            ? { active: { ...s.active, swaps: { ...s.active.swaps, [prescriptionId]: exerciseId } } }
            : {},
        ),

      setBlockNote: (prescriptionId, note) =>
        set((s) =>
          s.active
            ? { active: { ...s.active, notes: { ...s.active.notes, [prescriptionId]: note } } }
            : {},
        ),

      setWarmupsDone: (prescriptionId, count) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  // A session persisted before warm-up tracking existed has no map.
                  warmups: { ...(s.active.warmups ?? {}), [prescriptionId]: Math.max(0, count) },
                },
              }
            : {},
        ),

      finishSession: (meta) =>
        set((s) => {
          const active = s.active
          if (!active) return {}
          const startedAt = new Date(active.startedAt)

          // Entries are keyed by prescription (block) id. The exercise has to be
          // resolved from the programme — falling back to the block id would
          // write "w5-lowerA-b0" where "back-squat" belongs, which silently
          // orphans the set from history, records and volume.
          const session = getProgram(s.programStartDate)
            .weeks.find((w) => w.index === active.weekIndex)
            ?.sessions.find((x) => x.id === active.sessionId)

          const exercises = Object.entries(active.entries)
            .filter(([, sets]) => sets.length > 0)
            .map(([prescriptionId, sets]) => {
              const block = session?.blocks.find((b) => b.id === prescriptionId)
              return {
                prescriptionId,
                exerciseId: active.swaps[prescriptionId] ?? block?.exerciseId ?? prescriptionId,
                sets,
                note: active.notes[prescriptionId],
                swappedFromId: active.swaps[prescriptionId] ? block?.exerciseId : undefined,
              }
            })
          const log: WorkoutLog = {
            id: active.logId,
            date: todayISO(),
            weekIndex: active.weekIndex,
            sessionId: active.sessionId,
            sessionName: meta.sessionName,
            startedAt: active.startedAt,
            finishedAt: new Date().toISOString(),
            durationSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
            exercises,
            sessionRpe: meta.sessionRpe,
            notes: meta.notes,
          }
          return { logs: [...s.logs, log], active: null, restTimer: null }
        }),

      discardSession: () => set(() => ({ active: null, restTimer: null })),

      /* ---------------------------- rest timer -------------------------- */
      startRest: (seconds, label) =>
        set(() => ({ restTimer: { endsAt: Date.now() + seconds * 1000, totalSec: seconds, label } })),
      adjustRest: (delta) =>
        set((s) =>
          s.restTimer
            ? {
                restTimer: {
                  ...s.restTimer,
                  endsAt: s.restTimer.endsAt + delta * 1000,
                  totalSec: Math.max(15, s.restTimer.totalSec + delta),
                },
              }
            : {},
        ),
      stopRest: () => set(() => ({ restTimer: null })),

      /* ----------------------------- nutrition -------------------------- */
      toggleFood: (date, foodId) =>
        set((s) =>
          withDay(s, date, (day) => ({
            ...day,
            checked: { ...day.checked, [foodId]: !day.checked[foodId] },
          })),
        ),

      checkAllInMeal: (date, foodIds, checked) =>
        set((s) =>
          withDay(s, date, (day) => {
            const next = { ...day.checked }
            for (const id of foodIds) next[id] = checked
            return { ...day, checked: next }
          }),
        ),

      setMealSkipped: (date, mealId, skipped) =>
        set((s) =>
          withDay(s, date, (day) => ({
            ...day,
            skippedMeals: skipped
              ? [...new Set([...day.skippedMeals, mealId])]
              : day.skippedMeals.filter((m) => m !== mealId),
          })),
        ),

      setWater: (date, oz) =>
        set((s) => withDay(s, date, (day) => ({ ...day, waterOz: Math.max(0, oz) }))),

      setPortion: (date, foodId, multiplier) =>
        set((s) =>
          withDay(s, date, (day) => ({
            ...day,
            portions: { ...(day.portions ?? {}), [foodId]: multiplier },
          })),
        ),

      addExtraFood: (date, food) =>
        set((s) =>
          withDay(s, date, (day) => {
            const item: FoodItem = { ...food, id: uid('extra') }
            return { ...day, extras: [...day.extras, item], checked: { ...day.checked, [item.id]: true } }
          }),
        ),

      removeExtraFood: (date, foodId) =>
        set((s) =>
          withDay(s, date, (day) => ({ ...day, extras: day.extras.filter((f) => f.id !== foodId) })),
        ),

      /* -------------------------------- data ---------------------------- */
      // Reloading the sample data must not send an existing user back through
      // the welcome flow.
      resetToSeed: () => set(() => ({ ...seedState(), onboarded: true })),

      clearAllData: () =>
        set(() => ({
          ...seedState(),
          weighIns: [],
          measurements: [],
          photos: [],
          logs: [],
          checkIns: [],
          nutrition: {},
          active: null,
          restTimer: null,
          onboarded: true,
        })),

      importState: (raw) => {
        if (!raw || typeof raw !== 'object') return false
        const candidate = raw as Partial<AppState>
        if (!candidate.profile || !Array.isArray(candidate.weighIns)) return false
        set(() => ({
          profile: { ...get().profile, ...candidate.profile },
          settings: { ...get().settings, ...(candidate.settings ?? {}) },
          programStartDate: candidate.programStartDate ?? get().programStartDate,
          weighIns: candidate.weighIns ?? [],
          measurements: candidate.measurements ?? [],
          photos: candidate.photos ?? [],
          logs: candidate.logs ?? [],
          checkIns: candidate.checkIns ?? [],
          nutrition: candidate.nutrition ?? {},
          active: null,
          restTimer: null,
          onboarded: true,
        }))
        return true
      },
    }),
    {
      name: 'grit-store-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        programStartDate: s.programStartDate,
        weighIns: s.weighIns,
        measurements: s.measurements,
        photos: s.photos,
        logs: s.logs,
        checkIns: s.checkIns,
        nutrition: s.nutrition,
        active: s.active,
        restTimer: s.restTimer,
        seededAt: s.seededAt,
        onboarded: s.onboarded,
      }),
    },
  ),
)

/** Serialise everything the client owns, for the Settings export button. */
export function exportSnapshot(): string {
  const s = useStore.getState()
  return JSON.stringify(
    {
      app: 'GRIT',
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      settings: s.settings,
      programStartDate: s.programStartDate,
      weighIns: s.weighIns,
      measurements: s.measurements,
      photos: s.photos,
      logs: s.logs,
      checkIns: s.checkIns,
      nutrition: s.nutrition,
    },
    null,
    2,
  )
}
