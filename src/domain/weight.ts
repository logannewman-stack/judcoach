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
    return { date: entry.date, weight: entry.weight, avg: count ? sum / count : entry.weight }
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
    reliable: !stale && recent.length >= 10 && sampleDays >= 14,
  }
}

function daysAgoISO(fromISO: string, days: number): string {
  const d = new Date(`${fromISO}T00:00:00`)
  d.setDate(d.getDate() - days + 1)
  return toISODate(d)
}

/** Weeks until the goal at the current trend, or null when moving the wrong way. */
export function weeksToGoal(current: number, goal: number, perWeek: number): number | null {
  const remaining = goal - current
  if (Math.abs(remaining) < 0.25) return 0
  if (Math.abs(perWeek) < 0.05) return null
  if (Math.sign(remaining) !== Math.sign(perWeek)) return null
  return remaining / perWeek
}

/** How far along the start → goal journey the client is, 0..1. */
export function goalProgress(start: number, current: number, goal: number): number {
  const total = goal - start
  if (Math.abs(total) < 0.01) return 1
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
  const ratio = Math.abs(perWeek) / Math.abs(targetPerWeek)
  if (ratio < 0.5) return { status: 'slow', label: 'Slower than target' }
  if (ratio > 1.6) return { status: 'fast', label: 'Faster than target' }
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
