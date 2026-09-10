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
  /** Slope as a percentage of current bodyweight per week. */
  percentPerWeek: number
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

/** Least-squares slope in units per day. */
function slopePerDay(points: { x: number; y: number }[]): number {
  const n = points.length
  if (n < 2) return 0
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (const p of points) {
    sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y
  }
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-9) return 0
  return (n * sxy - sx * sy) / denom
}

export function summarizeTrend(entries: WeighIn[], days = 28, window = 7): TrendSummary | null {
  if (entries.length === 0) return null
  const series = rollingSeries(entries, window)
  const last = series[series.length - 1]!
  const cutoff = daysAgoISO(last.date, days)
  const recent = series.filter((p) => p.date >= cutoff)

  const sampleDays = daysBetween(recent[0]!.date, last.date) + 1
  const points = recent.map((p) => ({ x: daysBetween(recent[0]!.date, p.date), y: p.avg }))
  const perDay = slopePerDay(points)
  const perWeek = perDay * 7
  const first = recent[0]!

  return {
    current: last.avg,
    previous: first.avg,
    change: last.avg - first.avg,
    perWeek,
    percentPerWeek: last.avg > 0 ? (perWeek / last.avg) * 100 : 0,
    direction: Math.abs(perWeek) < 0.15 ? 'flat' : perWeek > 0 ? 'up' : 'down',
    sampleDays,
    entries: recent.length,
    reliable: recent.length >= 4 && sampleDays >= 7,
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
): { status: 'on-track' | 'fast' | 'slow' | 'wrong-way'; label: string } {
  if (Math.abs(targetPerWeek) < 0.05) {
    return Math.abs(perWeek) <= 0.35
      ? { status: 'on-track', label: 'Holding steady' }
      : { status: 'fast', label: 'Drifting off maintenance' }
  }
  if (Math.sign(perWeek) !== Math.sign(targetPerWeek) && Math.abs(perWeek) > 0.1) {
    return { status: 'wrong-way', label: 'Moving the wrong way' }
  }
  const ratio = Math.abs(perWeek) / Math.abs(targetPerWeek)
  if (ratio < 0.5) return { status: 'slow', label: 'Slower than target' }
  if (ratio > 1.6) return { status: 'fast', label: 'Faster than target' }
  return { status: 'on-track', label: 'On target' }
}

/** Longest run of consecutive days with a weigh-in, counting back from today. */
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
