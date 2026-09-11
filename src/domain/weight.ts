/* ============================================================================
   Weigh-in analytics
   Scale weight is noisy (water, sodium, gut content, glycogen). Everything a
   client sees is driven off a rolling average and a regression-fitted trend,
   never a day-to-day delta.
   ========================================================================== */

import type { WeighIn } from './types'
import { daysBetween, toISODate } from '../lib/date'

export interface TrendPoint {
  date: string
  weight: number
  /** Trailing rolling average across `window` days. */
  avg: number
  /** Readings the average was taken over — 1 means it is just that day's scale. */
  count: number
}

/**
 * Trailing rolling average. Gaps are handled by date, not by index, so a
 * missed day never shortens the window.
 */
export function rollingSeries(entries: WeighIn[], window = 7): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((entry, i) => {
    let sum = 0
    let count = 0
    for (let j = i; j >= 0; j--) {
      const other = sorted[j]!
      if (daysBetween(other.date, entry.date) >= window) break
      sum += other.weight
      count++
    }
    return {
      date: entry.date,
      weight: entry.weight,
      avg: count ? sum / count : entry.weight,
      count,
    }
  })
}

export interface TrendSummary {
  /** Latest rolling average — the number a coach actually reads. */
  current: number
  /** Rolling average `days` ago. */
  previous: number
  /** Change in the rolling average over the window. */
  change: number
  /** Least-squares slope, expressed per week. */
  perWeek: number
  /** Half-width of the 95% confidence interval on `perWeek`. */
  marginPerWeek: number
  /** Slope as a percentage of current bodyweight per week. */
  percentPerWeek: number
  /** True when the window held too little data and older entries were pulled in. */
  stale: boolean
  direction: 'up' | 'down' | 'flat'
  sampleDays: number
  entries: number
  /**
   * False while there is too little data for the slope to mean anything — a
   * couple of weigh-ins can imply any rate at all, and showing one as a verdict
   * would have a client chasing noise.
   */
  reliable: boolean
}

/**
 * What a slope has to be fitted on before it is worth quoting. Published so the
 * screen can name the shortfall — "6 of 10 weigh-ins" tells a client what to do
 * next, where a blank pill or a made-up rate tells them nothing.
 */
export const TREND_MIN_ENTRIES = 10
export const TREND_MIN_DAYS = 14

/**
 * Least-squares slope in units per day, with the standard error of that slope.
 *
 * The error matters as much as the estimate: a fortnight of ordinary water
 * fluctuation can fit a slope of ±1 lb/week either way, and a rate quoted
 * without its uncertainty has clients changing their food on noise.
 */
function fitSlope(points: { x: number; y: number }[]): { slope: number; se: number } {
  const n = points.length
  if (n < 3) return { slope: 0, se: Infinity }
  let sx = 0, sy = 0
  for (const p of points) { sx += p.x; sy += p.y }
  const mx = sx / n
  const my = sy / n
  let sxx = 0, sxy = 0
  for (const p of points) {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
  }
  if (sxx < 1e-9) return { slope: 0, se: Infinity }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  let sse = 0
  for (const p of points) sse += (p.y - (slope * p.x + intercept)) ** 2
  const se = Math.sqrt(sse / (n - 2) / sxx)
  return { slope, se: Number.isFinite(se) ? se : Infinity }
}

export function summarizeTrend(entries: WeighIn[], days = 28, window = 7): TrendSummary | null {
  if (entries.length === 0) return null
  const series = rollingSeries(entries, window)
  const last = series[series.length - 1]!
  const cutoff = daysAgoISO(last.date, days)
  let recent = series.filter((p) => p.date >= cutoff)

  // After a long gap the window can hold a single point. Reach further back
  // rather than reporting a zero slope, which would tell a client who gained
  // six pounds that nothing moved.
  const stale = recent.length < 3
  if (stale) recent = series.slice(-Math.min(series.length, 8))

  const first = recent[0]!
  const sampleDays = daysBetween(first.date, last.date) + 1

  // Fit the raw scale readings, not the smoothed ones: a rolling average is
  // heavily autocorrelated, which biases the slope low and understates its
  // error. The average is still what the client is shown.
  const { slope, se } = fitSlope(
    recent.map((p) => ({ x: daysBetween(first.date, p.date), y: p.weight })),
  )
  const perWeek = slope * 7
  const marginPerWeek = Number.isFinite(se) ? 1.96 * se * 7 : Infinity
  // Below a tenth of a percent of bodyweight a week, nobody can tell the
  // difference — and that threshold has to scale, or a kg user's "flat" band
  // is 2.2× as wide as a pound user's.
  const flatBand = Math.max(0.05, last.avg * 0.001)

  return {
    current: last.avg,
    previous: first.avg,
    change: last.avg - first.avg,
    perWeek,
    marginPerWeek,
    percentPerWeek: last.avg > 0 ? (perWeek / last.avg) * 100 : 0,
    direction: Math.abs(perWeek) < flatBand ? 'flat' : perWeek > 0 ? 'up' : 'down',
    sampleDays,
    entries: recent.length,
    stale,
    reliable: !stale && recent.length >= TREND_MIN_ENTRIES && sampleDays >= TREND_MIN_DAYS,
  }
}

/**
 * The line the plan puts the client on, anchored to the first point of whatever
 * stretch is being looked at. Drawn beside the trend so "on pace" is a shape the
 * eye reads in one go rather than two numbers to hold in the head.
 */
export function targetPace(
  series: TrendPoint[],
  perWeekTarget: number,
): { date: string; weight: number }[] {
  const first = series[0]
  if (!first || series.length < 2) return []
  return series.map((p) => ({
    date: p.date,
    weight: first.avg + (daysBetween(first.date, p.date) / 7) * perWeekTarget,
  }))
}

/** Days in the last `days` that carry a weigh-in — how much the average rests on. */
export function weighInsInLast(entries: WeighIn[], today: string, days = 7): number {
  const from = daysAgoISO(today, days)
  return new Set(entries.filter((e) => e.date >= from && e.date <= today).map((e) => e.date)).size
}

function daysAgoISO(fromISO: string, days: number): string {
  const d = new Date(`${fromISO}T00:00:00`)
  d.setDate(d.getDate() - days + 1)
  return toISODate(d)
}

/**
 * How close to the goal counts as standing on it. Scale weight moves further
 * than this between two readings of the same morning, so a quarter of a unit
 * either side is the same weight as far as a client is concerned. Shared, so the
 * bar cannot read full on a card whose own line says "goal reached" — or the
 * reverse.
 */
const GOAL_REACHED = 0.25

/** Weeks until the goal at the current trend, or null when moving the wrong way. */
export function weeksToGoal(current: number, goal: number, perWeek: number): number | null {
  const remaining = goal - current
  if (Math.abs(remaining) < GOAL_REACHED) return 0
  if (Math.abs(perWeek) < 0.05) return null
  if (Math.sign(remaining) !== Math.sign(perWeek)) return null
  return remaining / perWeek
}

/**
 * How far along the start → goal journey the client is, 0..1.
 *
 * A goal the same weight as the start has no journey to be a fraction of, and
 * reporting that as complete is the default way out of setup rather than an
 * exotic state: the start-weight pad seeds the goal from today's weight, so a
 * client who taps through without editing it arrives with start === goal and
 * watches the bar fill the track under a caption reading how far there still is
 * to go. With nowhere to travel the only honest reading is whether the client is
 * standing on the goal, which is the same test the finish line uses.
 */
export function goalProgress(start: number, current: number, goal: number): number {
  const total = goal - start
  if (Math.abs(total) < 0.01) return Math.abs(current - goal) < GOAL_REACHED ? 1 : 0
  const done = current - start
  const p = done / total
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/**
 * Compare the observed weekly rate against the coach's target rate.
 * `targetPerWeek` is signed: −1 means "lose one pound a week".
 */
export function rateVerdict(
  perWeek: number,
  targetPerWeek: number,
  /** 95% CI half-width on `perWeek`. A target inside the interval is met. */
  marginPerWeek = 0,
  /** Current bodyweight, so the maintenance band scales with the client. */
  bodyweight = 0,
): { status: 'on-track' | 'fast' | 'slow' | 'wrong-way'; label: string } {
  // If the target rate is inside the confidence interval, the data cannot
  // distinguish this client from one hitting it exactly. That is on target.
  if (Math.abs(perWeek - targetPerWeek) <= marginPerWeek) {
    return {
      status: 'on-track',
      label: Math.abs(targetPerWeek) < 0.05 ? 'Holding steady' : 'On target',
    }
  }
  const maintenanceBand = Math.max(0.2, bodyweight * 0.002)
  if (Math.abs(targetPerWeek) < 0.05) {
    return Math.abs(perWeek) <= maintenanceBand
      ? { status: 'on-track', label: 'Holding steady' }
      : { status: 'fast', label: 'Drifting off maintenance' }
  }
  if (Math.sign(perWeek) !== Math.sign(targetPerWeek) && Math.abs(perWeek) > maintenanceBand / 2) {
    return { status: 'wrong-way', label: 'Moving the wrong way' }
  }
  // Past this point the confidence interval has already excluded the target, so
  // the gap is real and the only question is whether it is worth acting on. Two
  // thirds of a prescribed rate is: across a twelve-week block that is four
  // pounds of lean gain turning into two, which is the block. The old ±60% band
  // called it "on target" and left the arrival date to break the news.
  const ratio = Math.abs(perWeek) / Math.abs(targetPerWeek)
  if (ratio < 0.7) return { status: 'slow', label: 'Slower than target' }
  if (ratio > 1.4) return { status: 'fast', label: 'Faster than target' }
  return { status: 'on-track', label: 'On target' }
}

/** Current run of consecutive days with a weigh-in, counting back from today. */
export function weighInStreak(entries: WeighIn[], today: string): number {
  const dates = new Set(entries.map((e) => e.date))
  let streak = 0
  const cursor = new Date(`${today}T00:00:00`)
  // A missed *today* shouldn't break a streak until the day is over.
  if (!dates.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(toISODate(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
