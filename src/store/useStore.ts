import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveSession, CheckIn, DayNutrition, FoodItem, LoggedSet, MeasurementEntry,
  Profile, ProgressPhoto, RestTimer, Settings, Units, WeighIn, WorkoutLog,
} from '../domain/types'
import { convertUnits } from '../domain/units'
import {
  SEED_PROFILE, SEED_SETTINGS, seedCheckIns, seedMeasurements, seedStartDate,
  seedWeighIns, seedWorkoutLogs,
} from '../data/seed'
import { getProgram } from '../data/program'
import { startOfWeek, todayISO } from '../lib/date'
import { uid } from '../lib/id'
import {
  createResilientStorage, mergePersisted, readPhotos, schedulePhotoWrite, writePhotos,
} from './persist'
import { guardPersistedShape, validateImport } from './importState'
import type { ImportResult } from './importState'

export interface AppState {
  /* ------------------------------- data ------------------------------- */
  profile: Profile
  settings: Settings
  /** The programme is rebuilt from this date, not stored set-by-set. */
  programStartDate: string
  /**
   * The day this client actually began. Sessions scheduled before it are not
   * "missed" — signing up on a Thursday shouldn't greet you with two overdue
   * workouts from a Monday you had no account for.
   */
  blockStartedOn: string
  weighIns: WeighIn[]
  measurements: MeasurementEntry[]
  photos: ProgressPhoto[]
  logs: WorkoutLog[]
  checkIns: CheckIn[]
  /** Keyed by ISO date; only days the client has touched are stored. */
  nutrition: Record<string, DayNutrition>
  /**
   * Days the client has overridden the programme on. Keyed by date, because the
   * choice belongs to the day it was made on: marking today a rest day must not
   * follow them into tomorrow.
   */
  dayModes: Record<string, 'training' | 'rest'>
  active: ActiveSession | null
  restTimer: RestTimer | null
  /** Bumped whenever demo data is regenerated, to force chart remounts. */
  seededAt: string
  /** False until the client has been through the welcome flow. */
  onboarded: boolean

  /* ------------------------------ profile ----------------------------- */
  completeOnboarding: () => void
  startFresh: () => void
  startNextBlock: () => void
  updateProfile: (patch: Partial<Profile>) => void
  updateSettings: (patch: Partial<Settings>) => void
  /** Converts every stored weight and length. False when nothing was changed. */
  setUnits: (next: Units) => boolean
  setTrainingMax: (exerciseId: string, value: number) => void

  /* ----------------------------- weigh-ins ---------------------------- */
  saveWeighIn: (entry: WeighIn) => void
  deleteWeighIn: (date: string) => void
  saveMeasurement: (entry: MeasurementEntry) => void
  deleteMeasurement: (date: string) => void
  deleteCheckIn: (id: string) => void
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
  setDayMode: (date: string, mode: 'training' | 'rest') => void
  setMealSkipped: (date: string, mealId: string, skipped: boolean) => void
  setWater: (date: string, oz: number) => void
  setPortion: (date: string, foodId: string, multiplier: number) => void
  addExtraFood: (date: string, food: Omit<FoodItem, 'id'>) => void
  removeExtraFood: (date: string, foodId: string) => void
  checkAllInMeal: (date: string, foodIds: string[], checked: boolean) => void

  /* -------------------------------- data ------------------------------ */
  resetToSeed: () => void
  clearAllData: () => void
  importState: (raw: unknown) => ImportResult
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
    photos: readPhotos<ProgressPhoto>(),
    logs: seedWorkoutLogs(today, startDate),
    checkIns: seedCheckIns(today),
    nutrition: {} as Record<string, DayNutrition>,
    dayModes: {} as Record<string, 'training' | 'rest'>,
    active: null,
    restTimer: null,
    seededAt: new Date().toISOString(),
    onboarded: false,
    blockStartedOn: startDate,
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
        set(() => ({
          weighIns: [],
          measurements: [],
          photos: [],
          logs: [],
          checkIns: [],
          nutrition: {},
          dayModes: {},
          active: null,
          restTimer: null,
          programStartDate: startOfWeek(todayISO(), 1),
          blockStartedOn: todayISO(),
          // A new client must not inherit the sample client's body or
          // strength — a pre-filled 465 lb deadlift reads as a suggestion.
          profile: {
            ...SEED_PROFILE,
            name: '',
            goalLabel: '',
            startWeight: 0,
            goalWeight: 0,
            trainingMaxes: {},
          },
        })),

      /**
       * Roll into the next block from this week, keeping the client's history
       * and maxes. Without it the programme simply runs out and pins everyone
       * on week eight forever.
       */
      startNextBlock: () =>
        set(() => ({
          programStartDate: startOfWeek(todayISO(), 1),
          blockStartedOn: todayISO(),
          active: null,
          restTimer: null,
        })),

      /* ------------------------------ profile --------------------------- */
      updateProfile: (patch) =>
        set((s) => {
          // Units are the one field that cannot be patched: changing the label
          // without converting the history silently reads every weight in the
          // app as the wrong unit. `setUnits` is the only way in.
          const { units: _ignored, ...rest } = patch
          return { profile: { ...s.profile, ...rest } }
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /**
       * Units are not a label on the data, so this cannot go through
       * `updateProfile`: the whole history converts with the profile, in one
       * write, or not at all. See domain/units.ts for what converts how.
       */
      setUnits: (next) => {
        const state = get()
        if (next === state.profile.units) return true
        const converted = convertUnits(state, next)
        if (!converted) return false
        set(() => converted)
        return true
      },
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
      deleteMeasurement: (date) =>
        set((s) => ({ measurements: s.measurements.filter((m) => m.date !== date) })),
      deleteCheckIn: (id) => set((s) => ({ checkIns: s.checkIns.filter((c) => c.id !== id) })),

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

      setDayMode: (date, mode) =>
        set((s) => ({ dayModes: { ...s.dayModes, [date]: mode } })),

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
        set((s) => ({
          ...seedState(),
          weighIns: [],
          measurements: [],
          photos: [],
          logs: [],
          checkIns: [],
          nutrition: {},
          dayModes: {},
          active: null,
          restTimer: null,
          onboarded: true,
          // Deleting your data must not hand you the sample client's name,
          // maxes and mid-block calendar back.
          programStartDate: startOfWeek(todayISO(), 1),
          blockStartedOn: todayISO(),
          profile: { ...s.profile, name: s.profile.name },
        })),

      /**
       * Replace everything from an exported file. Each record is validated and
       * repaired or dropped — a damaged one used to import cleanly and then
       * throw inside render on every launch, with the reset button unreachable
       * behind the blank screen.
       */
      importState: (raw) => {
        const result = validateImport(raw)
        if (!result.ok || !result.state) return result
        const next = result.state
        set(() => ({
          profile: { ...get().profile, ...next.profile },
          settings: { ...get().settings, ...next.settings },
          programStartDate: next.programStartDate ?? get().programStartDate,
          blockStartedOn: next.blockStartedOn ?? get().blockStartedOn,
          weighIns: next.weighIns,
          measurements: next.measurements,
          photos: next.photos,
          logs: next.logs,
          checkIns: next.checkIns,
          nutrition: next.nutrition,
          // An imported file's days are not the ones already overridden here.
          dayModes: {},
          // Never carry an in-flight workout or a running timer across an
          // import: their ids belong to the session that was interrupted.
          active: null,
          restTimer: null,
          onboarded: true,
        }))
        return result
      },
    }),
    {
      name: 'grit-store-v1',
      version: 2,
      storage: createJSONStorage(createResilientStorage),
      /* A top-level spread would drop any `profile` or `settings` field added
         after a client's first launch, rehydrating it as undefined. */
      merge: (persisted, current) => mergePersisted(guardPersistedShape(persisted), current),
      migrate: (persisted, version) => {
        const state = { ...(persisted as Record<string, unknown> | null) }
        if (version < 2 && Array.isArray(state.photos)) {
          // Photos used to ride along in the main blob. Give them their own key.
          writePhotos(state.photos as ProgressPhoto[])
        }
        return state
      },
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        programStartDate: s.programStartDate,
        blockStartedOn: s.blockStartedOn,
        weighIns: s.weighIns,
        measurements: s.measurements,
        logs: s.logs,
        checkIns: s.checkIns,
        nutrition: s.nutrition,
        dayModes: s.dayModes,
        active: s.active,
        restTimer: s.restTimer,
        seededAt: s.seededAt,
        onboarded: s.onboarded,
      }),
    },
  ),
)

/* Photos are persisted on their own key and their own schedule, so adding a
   progress photo never re-serialises the workout history and logging a set never
   re-serialises megabytes of base64. */
useStore.subscribe((state, previous) => {
  if (state.photos !== previous.photos) schedulePhotoWrite(state.photos)
})

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
