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

/** Today / Yesterday / Tomorrow, falling back to a short date. */
export function relativeDay(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return weekdayName(iso)
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`
  return formatShortDate(iso)
}

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
