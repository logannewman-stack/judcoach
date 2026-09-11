import type {
  ActiveSession, CheckIn, DayNutrition, FoodItem, LoggedExercise, LoggedSet,
  MeasurementEntry, Profile, ProgressPhoto, Settings, WeighIn, WorkoutLog,
} from '../domain/types'

/* ============================================================================
   Validating an imported file.

   An export is a plain JSON document a client can email to themselves, keep for
   a year, and re-import after the app has moved on several versions — or hand
   to the coach, who opens it in a text editor. So the only safe assumption is
   that every field might be missing, the wrong type, or nonsense.

   The old check was `profile exists && weighIns is an array`. Everything past
   that went in untouched, which meant a file with `weighIns: [null]` or
   `logs: [{}]` imported successfully and then threw inside render — on every
   subsequent launch, because it had already been persisted. The app came up
   blank with no way back to the reset button.

   So this coerces rather than rejects: each record is repaired if it can be and
   dropped if it cannot, and the caller is told how much was discarded.
   ========================================================================== */

export interface ImportResult {
  ok: boolean
  /** Why the file was unusable, when it was. */
  reason?: string
  state?: ImportedState
  /** Records that were dropped, by kind, for the confirmation message. */
  dropped: Record<string, number>
}

export interface ImportedState {
  profile: Partial<Profile>
  settings: Partial<Settings>
  programStartDate?: string
  blockStartedOn?: string
  blockNumber?: number
  weighIns: WeighIn[]
  measurements: MeasurementEntry[]
  photos: ProgressPhoto[]
  logs: WorkoutLog[]
  checkIns: CheckIn[]
  nutrition: Record<string, DayNutrition>
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A finite number, or a numeric string — older exports quoted their numbers. */
function numberOr(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function optionalNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function optionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function isoDate(v: unknown): string | undefined {
  return typeof v === 'string' && ISO_DATE.test(v) ? v : undefined
}

/** Map over a maybe-array, dropping anything the mapper rejects. */
function collect<T>(
  v: unknown,
  each: (item: Record<string, unknown>) => T | null,
): { out: T[]; dropped: number } {
  if (!Array.isArray(v)) return { out: [], dropped: 0 }
  const out: T[] = []
  let dropped = 0
  for (const item of v) {
    const mapped = isObject(item) ? each(item) : null
    if (mapped) out.push(mapped)
    else dropped += 1
  }
  return { out, dropped }
}

/* -------------------------------- records -------------------------------- */

function readProfile(v: unknown): Partial<Profile> {
  if (!isObject(v)) return {}
  const out: Partial<Profile> = {}
  if (typeof v.name === 'string') out.name = v.name.slice(0, 60)
  if (typeof v.goalLabel === 'string') out.goalLabel = v.goalLabel.slice(0, 80)
  if (v.units === 'lb' || v.units === 'kg') out.units = v.units
  if (v.sex === 'male' || v.sex === 'female') out.sex = v.sex
  for (const key of ['heightIn', 'birthYear', 'goalWeight', 'startWeight', 'barWeight',
                     'roundingIncrement', 'weeklyRateTarget'] as const) {
    const n = optionalNumber(v[key])
    if (n != null) out[key] = n
  }
  if (Array.isArray(v.availablePlates)) {
    const plates = v.availablePlates
      .map((p) => optionalNumber(p))
      .filter((p): p is number => p != null && p > 0)
    if (plates.length > 0) out.availablePlates = [...new Set(plates)].sort((a, b) => b - a)
  }
  if (isObject(v.trainingMaxes)) {
    const maxes: Record<string, number> = {}
    for (const [id, value] of Object.entries(v.trainingMaxes)) {
      const n = optionalNumber(value)
      if (n != null && n > 0) maxes[id] = n
    }
    out.trainingMaxes = maxes
  }
  return out
}

const THEMES = ['system', 'light', 'dark'] as const
const ACCENTS = ['blue', 'indigo', 'green', 'orange', 'pink', 'purple'] as const
const SWITCHES = [
  'haptics', 'restTimerAuto', 'restTimerSound', 'showRir', 'showPlateMath', 'keepAwake',
] as const
const NOTIFICATIONS = [
  'workoutReminder', 'weighInReminder', 'mealReminder', 'coachMessages',
] as const

/** One of a fixed set of strings, or nothing. */
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
}

/**
 * Settings are a closed set: two enums, six switches, two small integers and
 * four notification switches. So each one is read against what it can actually
 * be, rather than any string or any finite number being waved through.
 *
 * Waving them through is how a one-character typo in the JSON the docs say a
 * coach opens in a text editor — `weightUnitDecimals: 120` — imported cleanly,
 * persisted, and then threw `RangeError: toFixed() digits argument must be
 * between 0 and 100` inside render, replacing the whole app with the error
 * screen on every launch from then on. A value nothing in the app can produce
 * is not a setting, and this file exists to stop exactly that.
 */
function readSettings(v: unknown): Partial<Settings> {
  if (!isObject(v)) return {}
  const out: Partial<Settings> = {}

  const theme = oneOf(v.theme, THEMES)
  if (theme) out.theme = theme
  const accent = oneOf(v.accent, ACCENTS)
  if (accent) out.accent = accent

  for (const key of SWITCHES) {
    if (typeof v[key] === 'boolean') out[key] = v[key] as boolean
  }

  // Whole pounds or tenths are the only two the app offers, and the value goes
  // straight into `toFixed`, which throws on anything outside 0-100.
  const decimals = optionalNumber(v.weightUnitDecimals)
  if (decimals != null) out.weightUnitDecimals = Math.min(1, Math.max(0, Math.round(decimals)))

  const firstDay = optionalNumber(v.firstDayOfWeek)
  if (firstDay === 0 || firstDay === 1) out.firstDayOfWeek = firstDay

  if (isObject(v.notifications)) {
    const nested = v.notifications
    const notifications: Partial<Settings['notifications']> = {}
    for (const key of NOTIFICATIONS) {
      if (typeof nested[key] === 'boolean') notifications[key] = nested[key] as boolean
    }
    // Any switch the file omits is filled from the live settings on the way in.
    out.notifications = notifications as Settings['notifications']
  }
  return out
}

function readWeighIn(v: Record<string, unknown>): WeighIn | null {
  const date = isoDate(v.date)
  const weight = optionalNumber(v.weight)
  // A weigh-in without a date or a plausible weight cannot be charted or sorted.
  if (!date || weight == null || weight <= 0 || weight > 1500) return null
  return { date, weight, note: optionalString(v.note) }
}

function readMeasurement(v: Record<string, unknown>): MeasurementEntry | null {
  const date = isoDate(v.date)
  if (!date) return null
  const out: MeasurementEntry = { date }
  for (const key of ['waist', 'chest', 'hips', 'arm', 'thigh', 'neck', 'bodyFat'] as const) {
    const n = optionalNumber(v[key])
    if (n != null && n > 0) out[key] = n
  }
  return out
}

function readPhoto(v: Record<string, unknown>): ProgressPhoto | null {
  const date = isoDate(v.date)
  const dataUrl = typeof v.dataUrl === 'string' ? v.dataUrl : ''
  // Only inline images. A remote src in an imported file would phone home.
  if (!date || !dataUrl.startsWith('data:image/')) return null
  const pose = v.pose === 'side' || v.pose === 'back' ? v.pose : 'front'
  return { id: stringOr(v.id, `${date}-${pose}`), date, pose, dataUrl }
}

function readSet(v: Record<string, unknown>): LoggedSet | null {
  const weight = optionalNumber(v.weight)
  const reps = optionalNumber(v.reps)
  if (weight == null || weight < 0 || reps == null || reps <= 0) return null
  const rpe = optionalNumber(v.rpe)
  return {
    id: stringOr(v.id, `${weight}x${reps}-${Math.random().toString(36).slice(2, 8)}`),
    prescriptionId: optionalString(v.prescriptionId),
    weight,
    reps: Math.round(reps),
    rpe: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : undefined,
    completedAt: stringOr(v.completedAt, new Date().toISOString()),
    warmup: v.warmup === true,
  }
}

function readExercise(v: Record<string, unknown>): LoggedExercise | null {
  const exerciseId = optionalString(v.exerciseId)
  if (!exerciseId) return null
  const { out: sets } = collect(v.sets, readSet)
  if (sets.length === 0) return null
  return {
    exerciseId,
    prescriptionId: optionalString(v.prescriptionId),
    sets,
    note: optionalString(v.note),
    swappedFromId: optionalString(v.swappedFromId),
  }
}

function readLog(v: Record<string, unknown>): WorkoutLog | null {
  const date = isoDate(v.date)
  if (!date) return null
  const { out: exercises } = collect(v.exercises, readExercise)
  if (exercises.length === 0) return null
  return {
    id: stringOr(v.id, `log-${date}`),
    date,
    weekIndex: Math.round(numberOr(v.weekIndex, 1)),
    sessionId: stringOr(v.sessionId, 'imported'),
    sessionName: stringOr(v.sessionName, 'Imported workout'),
    startedAt: stringOr(v.startedAt, `${date}T12:00:00.000Z`),
    finishedAt: optionalString(v.finishedAt),
    durationSec: optionalNumber(v.durationSec),
    exercises,
    sessionRpe: optionalNumber(v.sessionRpe),
    notes: optionalString(v.notes),
  }
}

function readCheckIn(v: Record<string, unknown>): CheckIn | null {
  const date = isoDate(v.date)
  if (!date) return null
  const out = { ...v, id: stringOr(v.id, `check-${date}`), date } as unknown as CheckIn
  const weight = optionalNumber(v.weight)
  ;(out as { weight?: number }).weight = weight != null && weight > 0 ? weight : undefined
  for (const key of ['sleep', 'stress', 'energy', 'soreness', 'adherence'] as const) {
    const n = optionalNumber((v as Record<string, unknown>)[key])
    ;(out as unknown as Record<string, unknown>)[key] = n
  }
  return out
}

function readFood(v: Record<string, unknown>): FoodItem | null {
  const name = optionalString(v.name)
  if (!name) return null
  return {
    id: stringOr(v.id, `extra-${name}`),
    name,
    qty: numberOr(v.qty, 1),
    unit: stringOr(v.unit, ''),
    kcal: Math.max(0, numberOr(v.kcal, 0)),
    protein: Math.max(0, numberOr(v.protein, 0)),
    carbs: Math.max(0, numberOr(v.carbs, 0)),
    fat: Math.max(0, numberOr(v.fat, 0)),
    fiber: optionalNumber(v.fiber),
  }
}

function readNutrition(v: unknown): { out: Record<string, DayNutrition>; dropped: number } {
  if (!isObject(v)) return { out: {}, dropped: 0 }
  const out: Record<string, DayNutrition> = {}
  let dropped = 0
  for (const [date, day] of Object.entries(v)) {
    if (!ISO_DATE.test(date) || !isObject(day)) {
      dropped += 1
      continue
    }
    const checked: Record<string, boolean> = {}
    if (isObject(day.checked)) {
      for (const [id, on] of Object.entries(day.checked)) if (on === true) checked[id] = true
    }
    const portions: Record<string, number> = {}
    if (isObject(day.portions)) {
      for (const [id, mult] of Object.entries(day.portions)) {
        const n = optionalNumber(mult)
        if (n != null && n > 0 && n <= 10) portions[id] = n
      }
    }
    const { out: extras } = collect(day.extras, readFood)
    out[date] = {
      date,
      checked,
      portions,
      waterOz: Math.max(0, numberOr(day.waterOz, 0)),
      extras,
      skippedMeals: Array.isArray(day.skippedMeals)
        ? day.skippedMeals.filter((m): m is string => typeof m === 'string')
        : [],
    }
  }
  return { out, dropped }
}

/* ------------------------------ rehydration ------------------------------ */

/**
 * Cheap structural guard for what comes back out of storage on launch.
 *
 * Full validation would be wrong here: it walks every set on every launch, and a
 * bug in it would silently discard a real client's history. This only fixes the
 * kind of damage that makes the app unrenderable — a collection that is not a
 * collection — and leaves the contents alone.
 *
 * A collection that has to be replaced becomes empty rather than falling back to
 * the defaults, because the defaults are the sample client's data and showing
 * someone else's workouts as your own is worse than showing none.
 */
export function guardPersistedShape(persisted: unknown): unknown {
  if (!isObject(persisted)) return persisted
  const out = { ...persisted }

  for (const key of ['weighIns', 'measurements', 'photos', 'logs', 'checkIns'] as const) {
    if (key in out && !Array.isArray(out[key])) out[key] = []
  }
  for (const key of ['nutrition', 'dayModes'] as const) {
    if (key in out && !isObject(out[key])) out[key] = {}
  }
  for (const key of ['profile', 'settings'] as const) {
    if (key in out && !isObject(out[key])) delete out[key]
  }
  for (const key of ['active', 'restTimer'] as const) {
    if (key in out && !isObject(out[key])) out[key] = null
  }
  for (const key of ['programStartDate', 'blockStartedOn', 'seededAt'] as const) {
    if (key in out && typeof out[key] !== 'string') delete out[key]
  }
  // A block number out of a damaged file must not become NaN in a heading.
  if ('blockNumber' in out
    && (typeof out.blockNumber !== 'number' || !Number.isFinite(out.blockNumber) || out.blockNumber < 1)) {
    delete out.blockNumber
  }
  if ('onboarded' in out && typeof out.onboarded !== 'boolean') delete out.onboarded

  return out
}

/* --------------------------------- entry --------------------------------- */

/** Every key an export is spelled with, for telling one from any other JSON. */
const EXPORT_KEYS = [
  'profile', 'settings', 'programStartDate', 'blockStartedOn', 'blockNumber',
  'weighIns', 'measurements', 'photos', 'logs', 'checkIns', 'nutrition',
] as const

/**
 * Read an imported export into state the app can render. Returns `ok: false`
 * only when the file is not a GRIT export at all; a file that is one but has
 * damaged records imports the rest and reports the count.
 */
export function validateImport(raw: unknown): ImportResult {
  const dropped: Record<string, number> = {}
  const notOurs = { ok: false, reason: "That file isn't a GRIT backup.", dropped }
  if (!isObject(raw)) return notOurs

  // What this app stamps on everything it writes. A file that says so is one of
  // ours whatever is left in it — restoring a backup of an emptied phone is a
  // real thing to want, and `app` is not a key anything else produces by chance.
  const declared = raw.app === 'GRIT'
  if (!declared && !EXPORT_KEYS.some((key) => key in raw)) return notOurs

  const weighIns = collect(raw.weighIns, readWeighIn)
  const measurements = collect(raw.measurements, readMeasurement)
  const photos = collect(raw.photos, readPhoto)
  const logs = collect(raw.logs, readLog)
  const checkIns = collect(raw.checkIns, readCheckIn)
  const nutrition = readNutrition(raw.nutrition)

  if (weighIns.dropped) dropped['weigh-ins'] = weighIns.dropped
  if (measurements.dropped) dropped.measurements = measurements.dropped
  if (photos.dropped) dropped.photos = photos.dropped
  if (logs.dropped) dropped.workouts = logs.dropped
  if (checkIns.dropped) dropped['check-ins'] = checkIns.dropped
  if (nutrition.dropped) dropped.days = nutrition.dropped

  /* An undeclared file has to hold something a GRIT backup holds, not merely a
     key one is spelled with. `{"profile":{"name":"Bob"}}` satisfied the old test
     and imported cleanly: nineteen workouts and sixty-three weigh-ins gone, an
     empty history left sitting under a stranger's name — and, because the
     profile merges field by field, still carrying the old client's 465 lb
     deadlift. A file that carries no record is not a backup of anything. */
  const records = weighIns.out.length + measurements.out.length + photos.out.length
    + logs.out.length + checkIns.out.length + Object.keys(nutrition.out).length
  if (!declared && records === 0) {
    return { ok: false, reason: "That file has no GRIT records in it.", dropped }
  }

  /* Oldest first, which is the order every writer in the store keeps and every
     reader assumes: the Weigh-In screen takes the last entry as the latest
     reading and the first as the baseline, and Guidelines reads today's
     bodyweight off the end of the list. Handing them a reversed history made a
     round trip through the client's own backup report a reading 74 days stale
     and 3.7 lb wrong, and collapsed the chart's range control to a single day. */
  const byDate = <T extends { date: string }>(list: T[]) =>
    [...list].sort((a, b) => a.date.localeCompare(b.date))

  return {
    ok: true,
    dropped,
    state: {
      profile: readProfile(raw.profile),
      settings: readSettings(raw.settings),
      programStartDate: isoDate(raw.programStartDate),
      blockStartedOn: isoDate(raw.blockStartedOn),
      blockNumber: typeof raw.blockNumber === 'number' && Number.isFinite(raw.blockNumber)
        && raw.blockNumber >= 1
        ? Math.floor(raw.blockNumber)
        : undefined,
      weighIns: byDate(weighIns.out),
      measurements: byDate(measurements.out),
      // Photos are the exception: `addPhoto` puts the newest at the head, and
      // the library is read in that order.
      photos: [...photos.out].sort((a, b) => b.date.localeCompare(a.date)),
      logs: byDate(logs.out),
      checkIns: byDate(checkIns.out),
      nutrition: nutrition.out,
    },
  }
}

/** "3 workouts and 1 photo" for the confirmation message. */
export function describeDropped(dropped: Record<string, number>): string | null {
  const parts = Object.entries(dropped).map(([kind, n]) => `${n} ${kind}`)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export type { ActiveSession }
