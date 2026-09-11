/* Date helpers. Everything is local-time and ISO `yyyy-mm-dd` on the wire. */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse `yyyy-mm-dd` as local midnight (not UTC, which shifts the day back). */
export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

export const todayISO = (): string => toISODate(new Date())

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime()
  return Math.round(ms / 86400000)
}

export function startOfWeek(iso: string, firstDay: 0 | 1 = 1): string {
  const d = fromISODate(iso)
  const shift = (d.getDay() - firstDay + 7) % 7
  d.setDate(d.getDate() - shift)
  return toISODate(d)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const weekdayName = (iso: string) => WEEKDAYS[fromISODate(iso).getDay()]!
export const weekdayMin = (dow: number) => WEEKDAYS_MIN[dow]!
export const weekdayShortFromDow = (dow: number) => WEEKDAYS_SHORT[dow]!

/** "Mar 14" */
export function formatShortDate(iso: string): string {
  const d = fromISODate(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** "Thursday, March 14" */
export function formatLongDate(iso: string): string {
  const d = fromISODate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** "Thu, Mar 14" */
export function formatMediumDate(iso: string): string {
  const d = fromISODate(iso)
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** What a relative phrase is made of, which is what a caller has to know. */
export type WhenKind = 'adverb' | 'weekday' | 'date'

export interface RelativeWhen {
  /** Ready for a headline: "Today", "3 days ago", "Monday", "Aug 20". */
  label: string
  /** The same thing mid-sentence: "today", but still "Monday" and "Aug 20". */
  lower: string
  /**
   * What `label` is made of. `'adverb'` is the app's own wording and the only
   * kind whose case changes; `'date'` tells a caller that is already showing the
   * date not to show it twice.
   */
  kind: WhenKind
}

/**
 * When something was, in the one wording the whole app uses.
 *
 * There were three of these and they disagreed. A Check-ins card printed one
 * date as both "6 days ago" and "Sep 4", because the only way it could tell
 * whether the phrase was already a date was to ask whether the date ended with
 * it — so `kind` answers that outright. Callers needing the words mid-sentence
 * lower-cased the whole return value, which turned a weekday into "monday" and a
 * date into "aug 20", so the casing is settled here too: only the app's own
 * words change.
 *
 * Minutes and hours only where the value carries a clock and the instant is
 * still today. "23h ago" about yesterday reads like a riddle, and counting in
 * 24-hour blocks called something sent thirty hours ago "yesterday" when it was
 * two mornings back.
 */
export function relativeTime(iso: string, now: Date | string = new Date()): RelativeWhen {
  const name = (label: string, kind: WhenKind): RelativeWhen => ({ label, lower: label, kind })
  const adverb = (label: string): RelativeWhen =>
    ({ label, lower: label.toLowerCase(), kind: 'adverb' })

  // A caller that passed a day rather than an instant has no clock to measure
  // against, so the answer stays at day granularity.
  const instant = typeof now === 'string' || iso.length <= 10 ? null : new Date(iso)
  const at = instant && Number.isFinite(instant.getTime()) ? instant : null
  // Local, not the UTC slice of the string: a timestamp just after midnight in
  // one zone belongs to the other day in the other.
  const date = at ? toISODate(at) : iso.slice(0, 10)
  const today = typeof now === 'string' ? now : toISODate(now)
  const diff = daysBetween(today, date)

  if (diff === 0 && at) {
    const minutes = Math.floor(((now as Date).getTime() - at.getTime()) / 60_000)
    if (minutes < 1) return adverb('Just now')
    if (minutes < 60) return adverb(`${minutes}m ago`)
    return adverb(`${Math.floor(minutes / 60)}h ago`)
  }
  if (diff === 0) return adverb('Today')
  if (diff === -1) return adverb('Yesterday')
  if (diff === 1) return adverb('Tomorrow')
  if (diff > 1 && diff < 7) return name(weekdayName(date), 'weekday')
  if (diff < -1 && diff > -7) return adverb(`${Math.abs(diff)} days ago`)
  return name(formatShortDate(date), 'date')
}

/**
 * The headline wording on its own, for the callers that want nothing else.
 * `relativeTime` is the rule; this is the one field of it they read.
 */
export const relativeDay = (iso: string, today: string = todayISO()): string =>
  relativeTime(iso, today).label

/** "2:30" / "1:04:09" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** "48 min" / "1h 12m" */
export function formatMinutes(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** "7:30 AM" from "07:30". */
export function formatClock(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

export function timeOfDayGreeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
