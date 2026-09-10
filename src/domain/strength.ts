/* ============================================================================
   Strength math — RPE/RIR ↔ %1RM, estimated maxes, load rounding, plate solving
   ========================================================================== */

import type { LoggedSet, Profile, SetPrescription } from './types'

/**
 * Reps-in-reserve chart (Reactive Training Systems). Rows are RPE from 10 down
 * to 6 in half-point steps; columns are reps 1..12. Values are % of 1RM.
 *
 * Reading it: "5 reps @ RPE 8" means 5 reps with 2 left in the tank, which
 * historically lands at ~81% of a true single.
 */
export const RPE_CHART: Record<string, number[]> = {
  // reps:  1     2     3     4     5     6     7     8     9     10    11    12
  '10':  [100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0],
  '9.5': [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7],
  '9':   [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3],
  '8.5': [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0],
  '8':   [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6],
  '7.5': [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3],
  '7':   [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9],
  '6.5': [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3, 58.6],
  '6':   [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9, 57.2],
}

export const RPE_STEPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const
export const MIN_RPE = 6
export const MAX_RPE = 10

/** RIR and RPE are two views of the same number. */
export const rpeToRir = (rpe: number): number => clamp(10 - rpe, 0, 10)
export const rirToRpe = (rir: number): number => clamp(10 - rir, MIN_RPE, MAX_RPE)

export function formatRir(rir: number): string {
  if (rir <= 0) return '0 RIR'
  return Number.isInteger(rir) ? `${rir} RIR` : `${rir.toFixed(1)} RIR`
}

export function formatRpe(rpe: number): string {
  return Number.isInteger(rpe) ? `RPE ${rpe}` : `RPE ${rpe.toFixed(1)}`
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Snap an arbitrary RPE to the nearest half point inside the chart's range. */
export function snapRpe(rpe: number): number {
  return clamp(Math.round(rpe * 2) / 2, MIN_RPE, MAX_RPE)
}

/**
 * Percentage of 1RM for a reps × RPE pairing. Out-of-chart inputs degrade
 * gracefully: reps beyond 12 extrapolate with Epley, RPE below 6 extends the
 * chart's own ~1.5%-per-half-point slope.
 */
export function percentOf1RM(reps: number, rpe: number): number {
  const r = Math.max(1, Math.round(reps))
  const clampedRpe = clamp(snapRpe(rpe), MIN_RPE, MAX_RPE)

  if (r <= 12) {
    const row = RPE_CHART[String(clampedRpe)]
    if (row) return row[r - 1]!
  }

  // Beyond 12 reps: treat "reps at RPE X" as "reps + RIR reps to failure" and
  // invert Epley, which is well-behaved in the high-rep range.
  const rir = rpeToRir(clampedRpe)
  const repsToFailure = r + rir
  return (100 / (1 + repsToFailure / 30))
}

/** Estimated 1RM implied by a completed set. */
export function e1RM(weight: number, reps: number, rpe?: number): number {
  if (weight <= 0 || reps <= 0) return 0
  const effectiveRpe = rpe ?? 10 // no RPE recorded → assume it was a hard set
  const pct = percentOf1RM(reps, effectiveRpe)
  return (weight * 100) / pct
}

/** Load that should produce `reps` at `rpe`, given a max. */
export function loadFor(max: number, reps: number, rpe: number): number {
  return (max * percentOf1RM(reps, rpe)) / 100
}

/**
 * Reps you should be able to hit at a given load and RPE — used to sanity-check
 * a prescription against the client's current training max.
 */
export function repsAt(max: number, weight: number, rpe: number): number {
  if (max <= 0) return 0
  const target = (weight / max) * 100
  for (let reps = 1; reps <= 12; reps++) {
    if (percentOf1RM(reps, rpe) <= target) return reps
  }
  return 12
}

/* ------------------------------- rounding ------------------------------- */

/** Round to the smallest jump the gym's plates actually allow. */
export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return Math.round(weight * 10) / 10
  return Math.round(weight / increment) * increment
}

/* ---------------------------- plate solving ----------------------------- */

export interface PlateStack {
  /** Plates on ONE side of the bar, heaviest first. */
  perSide: number[]
  /** Weight actually achievable with the available plates. */
  achievable: number
  /** Positive when the bar comes up short of the target. */
  remainder: number
  barOnly: boolean
}

/**
 * Greedy plate loading. Plates are stated per-pair inventory, so a single 45
 * in `availablePlates` means one 45 per side is available.
 */
export function solvePlates(
  target: number,
  barWeight: number,
  availablePlates: number[],
): PlateStack {
  if (target <= barWeight) {
    return { perSide: [], achievable: barWeight, remainder: target - barWeight, barOnly: true }
  }
  let perSideRemaining = (target - barWeight) / 2
  const plates = [...availablePlates].sort((a, b) => b - a)
  const perSide: number[] = []

  for (const plate of plates) {
    // Cap each denomination at 8 per side so a bad target can't loop forever.
    let used = 0
    while (perSideRemaining >= plate - 1e-6 && used < 8) {
      perSide.push(plate)
      perSideRemaining -= plate
      used++
    }
  }
  const achievable = barWeight + 2 * perSide.reduce((s, p) => s + p, 0)
  return {
    perSide,
    achievable,
    remainder: Math.round((target - achievable) * 100) / 100,
    barOnly: perSide.length === 0,
  }
}

/** Collapse [45,45,25,10] → [{plate:45,count:2},{plate:25,count:1}…] for display. */
export function groupPlates(perSide: number[]): { plate: number; count: number }[] {
  const out: { plate: number; count: number }[] = []
  for (const p of perSide) {
    const last = out[out.length - 1]
    if (last && last.plate === p) last.count++
    else out.push({ plate: p, count: 1 })
  }
  return out
}

/* -------------------------- prescription → load ------------------------- */

export interface ResolvedSet {
  prescription: SetPrescription
  /** Computed working load; undefined when the set is fully autoregulated. */
  targetWeight?: number
  /** Percent of training max this load represents. */
  percent?: number
  rpe?: number
  rir?: number
  repsLabel: string
  loadLabel: string
  restSec: number
}

export function describeReps(set: SetPrescription): string {
  if (set.amrap) return `${set.reps}+`
  if (set.repsMax && set.repsMax !== set.reps) return `${set.reps}–${set.repsMax}`
  return String(set.reps)
}

/**
 * Turn a prescription into a concrete target for today, given the client's
 * training max, their rounding rules and (for back-off sets) the top set they
 * already hit this session.
 */
export function resolveSet(
  set: SetPrescription,
  opts: {
    trainingMax?: number
    profile: Pick<Profile, 'roundingIncrement' | 'units'>
    topSetWeight?: number
    bodyweight?: number
  },
): ResolvedSet {
  const { trainingMax, profile, topSetWeight, bodyweight } = opts
  const rpe = set.rpe
  const rir = rpe != null ? rpeToRir(rpe) : undefined
  const repsLabel = describeReps(set)
  const rest = set.restSec ?? 180

  const round = (w: number) => roundToIncrement(w, profile.roundingIncrement)

  const finish = (weight: number | undefined, percent: number | undefined, loadLabel: string): ResolvedSet => ({
    prescription: set,
    targetWeight: weight,
    percent,
    rpe,
    rir,
    repsLabel,
    loadLabel,
    restSec: rest,
  })

  switch (set.load.kind) {
    case 'percent': {
      const pct = set.load.value
      if (!trainingMax) return finish(undefined, pct, `${pct}% TM`)
      return finish(round((trainingMax * pct) / 100), pct, `${pct}%`)
    }
    case 'weight':
      return finish(round(set.load.value), undefined, `${round(set.load.value)} ${profile.units}`)
    case 'backoff': {
      const pct = set.load.pctOfTop
      if (!topSetWeight) return finish(undefined, undefined, `${pct}% of top set`)
      return finish(round((topSetWeight * pct) / 100), undefined, `${pct}% of top`)
    }
    case 'bodyweight':
      return finish(bodyweight ? round(bodyweight) : undefined, undefined, 'Bodyweight')
    case 'rpe':
    default: {
      // Autoregulated: estimate from the training max so the client has an
      // anchor, but the RPE target is what governs.
      if (trainingMax && rpe != null) {
        const est = round(loadFor(trainingMax, set.reps, rpe))
        return finish(est, percentOf1RM(set.reps, rpe), 'Work up')
      }
      return finish(undefined, undefined, 'Work up')
    }
  }
}

/* ----------------------------- autoregulation --------------------------- */

export type AdjustmentDirection = 'up' | 'down' | 'hold'

export interface LoadAdjustment {
  direction: AdjustmentDirection
  suggestedWeight: number
  delta: number
  reason: string
}

/**
 * After a logged set, compare what happened with what was asked for and suggest
 * the next set's load. This is the autoregulation clients actually need: an
 * RPE that lands a full point light means the load was too conservative.
 */
export function suggestNextLoad(
  logged: LoggedSet,
  target: { reps: number; rpe?: number; weight?: number; amrap?: boolean },
  increment: number,
): LoadAdjustment | null {
  if (target.rpe == null || logged.rpe == null) return null
  const diff = target.rpe - logged.rpe // positive → set was easier than asked
  const base = logged.weight
  // An AMRAP set is defined by the RPE it stops at, so rep count can't "miss".
  const hitReps = target.amrap || logged.reps >= target.reps

  if (!hitReps && logged.rpe >= target.rpe) {
    const next = roundToIncrement(base * 0.93, increment)
    return {
      direction: 'down',
      suggestedWeight: next,
      delta: next - base,
      reason: `Missed reps at ${formatRpe(logged.rpe)} — drop to keep quality high.`,
    }
  }
  if (diff >= 1) {
    const next = roundToIncrement(base * 1.05, increment)
    return {
      direction: 'up',
      suggestedWeight: next,
      delta: next - base,
      reason: `${diff.toFixed(1)} RPE under target — add load.`,
    }
  }
  if (diff >= 0.5) {
    const next = roundToIncrement(base * 1.025, increment)
    return {
      direction: 'up',
      suggestedWeight: next,
      delta: next - base,
      reason: 'Slightly under target — small bump.',
    }
  }
  if (diff <= -1) {
    const next = roundToIncrement(base * 0.95, increment)
    return {
      direction: 'down',
      suggestedWeight: next,
      delta: next - base,
      reason: `${Math.abs(diff).toFixed(1)} RPE over target — back off.`,
    }
  }
  return { direction: 'hold', suggestedWeight: base, delta: 0, reason: 'Dialled in — repeat the load.' }
}

/* ------------------------------ set volume ------------------------------ */

export const setTonnage = (s: LoggedSet): number => s.weight * s.reps

export function sessionTonnage(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + (s.warmup ? 0 : setTonnage(s)), 0)
}

/** Best estimated max across a group of sets. */
export function bestE1RM(sets: LoggedSet[]): number {
  return sets.reduce((best, s) => (s.warmup ? best : Math.max(best, e1RM(s.weight, s.reps, s.rpe))), 0)
}

/** The heaviest non-warmup set, used to anchor back-off percentages. */
export function topSet(sets: LoggedSet[]): LoggedSet | undefined {
  let best: LoggedSet | undefined
  for (const s of sets) {
    if (s.warmup) continue
    if (!best || s.weight > best.weight) best = s
  }
  return best
}

/* ------------------------------- warm-ups ------------------------------- */

export interface WarmupSet {
  weight: number
  reps: number
  label: string
}

/**
 * Build a sensible ramp to the first working set. Percentages are of the work
 * weight, not the training max, so a light day gets a short ramp.
 */
export function buildWarmup(
  workWeight: number,
  barWeight: number,
  increment: number,
): WarmupSet[] {
  if (workWeight <= barWeight * 1.2) return []
  const steps = [
    { pct: 0, reps: 8, label: 'Bar' },
    { pct: 0.5, reps: 5, label: '50%' },
    { pct: 0.7, reps: 3, label: '70%' },
    { pct: 0.85, reps: 1, label: '85%' },
  ]
  const out: WarmupSet[] = []
  for (const s of steps) {
    const w = s.pct === 0 ? barWeight : roundToIncrement(workWeight * s.pct, increment)
    if (w >= workWeight) break
    if (out.length && w <= out[out.length - 1]!.weight) continue
    out.push({ weight: w, reps: s.reps, label: s.label })
  }
  return out
}

/* ------------------------------ conversions ----------------------------- */

export const LB_PER_KG = 2.2046226218

export const lbToKg = (lb: number) => lb / LB_PER_KG
export const kgToLb = (kg: number) => kg * LB_PER_KG

/** Standard plate inventories by unit. */
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5]
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
