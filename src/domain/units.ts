/* ============================================================================
   Switching units

   A unit is not a label on the data: every weight, every tape reading and the
   gym's own hardware are stored in whichever unit the client picked. Switching
   therefore has to rewrite the lot in one pass — a switch that converted the
   profile and relabelled the rest left a 200 lb weigh-in history sitting under
   a 90 kg goal and logged sets of 315 kg.

   Two kinds of number, converted two different ways:

   · What was *recorded* — weigh-ins, check-ins, logged sets, the tape — already
     happened, so it converts faithfully and is rounded only to the precision the
     app writes it at. Snapping a 315 lb set onto a kilo plate grid would claim
     the client lifted 142.5 kg, which they did not.

   · What will be *prescribed* — working maxes, the bar, the plate rack, the
     rounding step — is kit and forward-looking, so it becomes the equivalent kit
     in the new unit. Percentage work still lands on loadable numbers because
     `resolveSet` rounds every target to `roundingIncrement` at the point of use.
   ========================================================================== */

import type {
  ActiveSession, CheckIn, LoggedSet, MeasurementEntry, Profile, Units, WeighIn, WorkoutLog,
} from './types'
import {
  DEFAULT_PLATES_KG, DEFAULT_PLATES_LB, kgToLb, lbToKg, roundToIncrement,
} from './strength'
import { num } from '../lib/format'

/* ------------------------------- lengths -------------------------------- */

const CM_PER_IN = 2.54

export const inToCm = (inches: number): number => inches * CM_PER_IN
export const cmToIn = (cm: number): number => cm / CM_PER_IN

/** The tape follows the weight unit: pounds and inches, kilos and centimetres. */
export const lengthUnit = (units: Units): 'in' | 'cm' => (units === 'kg' ? 'cm' : 'in')

/** An inch mark reads naturally straight after the number; centimetres need the word. */
export const formatLength = (value: number, units: Units): string =>
  units === 'kg' ? `${num(value, 1)} cm` : `${num(value, 1)}″`

/** Tape steps a client reaches for, a tenth of an inch being finer than a tenth of a cm. */
export const tapeSteps = (units: Units): number[] =>
  units === 'kg' ? [-1, -0.2, 0.2, 1] : [-0.5, -0.1, 0.1, 0.5]

/* ------------------------------- hardware ------------------------------- */

/**
 * Plate denominations that stand in for one another, paired by the job each does
 * on the bar rather than by what it weighs — a kilo gym stocks no 45 and a pound
 * gym stocks no 25 kg. The heaviest pound plate answers for both big kilo
 * plates, so a full rack converts to a full rack whichever way the switch goes.
 */
const PLATE_PAIRS: { lb: number; kg: number }[] = [
  { lb: 45, kg: 25 },
  { lb: 45, kg: 20 },
  { lb: 35, kg: 15 },
  { lb: 25, kg: 10 },
  { lb: 10, kg: 5 },
  { lb: 5, kg: 2.5 },
  { lb: 2.5, kg: 1.25 },
]

/** The rounding steps Bar & plates offers, paired across units by how fine they are. */
const INCREMENT_PAIRS: { lb: number; kg: number }[] = [
  { lb: 2.5, kg: 1 },
  { lb: 5, kg: 2.5 },
  { lb: 10, kg: 5 },
]

/** Bars come in whole plate jumps, so the converted bar is snapped to one. */
const BAR_STEP: Record<Units, number> = { lb: 5, kg: 2.5 }

const defaultPlates = (units: Units): number[] =>
  units === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB

const nearest = (value: number, options: number[]): number =>
  options.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best))

/**
 * Translate the plate rack. Pairing by role is what keeps the client's edits:
 * turn off the 2.5s because your gym has none and you get a kilo rack with no
 * 1.25s, rather than the micro plates quietly reappearing.
 */
function convertPlates(plates: number[], to: Units): number[] {
  const translated = new Set<number>()
  for (const plate of plates) {
    const paired = PLATE_PAIRS.filter((p) => (to === 'kg' ? p.lb : p.kg) === plate)
    if (paired.length > 0) {
      for (const p of paired) translated.add(to === 'kg' ? p.kg : p.lb)
      continue
    }
    // An imported rack can hold a denomination no gym pairs with. Convert it and
    // take the nearest plate that actually exists in the target unit.
    const converted = to === 'kg' ? lbToKg(plate) : kgToLb(plate)
    translated.add(nearest(converted, defaultPlates(to)))
  }
  // An empty rack leaves the plate calculator nothing to solve with.
  if (translated.size === 0) return [...defaultPlates(to)]
  return [...translated].sort((a, b) => b - a)
}

function convertIncrement(increment: number, to: Units): number {
  const paired = INCREMENT_PAIRS.find((p) => (to === 'kg' ? p.lb : p.kg) === increment)
  if (paired) return to === 'kg' ? paired.kg : paired.lb
  const converted = to === 'kg' ? lbToKg(increment) : kgToLb(increment)
  return nearest(converted, INCREMENT_PAIRS.map((p) => (to === 'kg' ? p.kg : p.lb)))
}

/* ------------------------------ conversion ------------------------------ */

/** Round to the decimals the app writes this kind of number at. */
const places = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * The goal label carries its unit as prose — "Lean gain · 0.4 lb / week" — so a
 * converted rate under the old unit's name is the same lie in words. Only a
 * label the app generated is rewritten; anything else is the client's and stays.
 */
function convertGoalLabel(label: string, rate: number, to: Units): string {
  const generated = /^(.*·\s*)[\d.]+\s*(?:lb|kg)\s*\/\s*week$/.exec(label)
  if (!generated) return label
  return `${generated[1]}${num(Math.abs(rate), 2)} ${to} / week`
}

/** Everything held in a weight or a length, as one switchable unit. */
export interface UnitScopedState {
  profile: Profile
  weighIns: WeighIn[]
  measurements: MeasurementEntry[]
  checkIns: CheckIn[]
  logs: WorkoutLog[]
  active: ActiveSession | null
}

/**
 * Convert every stored weight and length into `to`.
 *
 * Returns null — changing nothing — if any single number cannot be converted,
 * because a half-applied switch is worse than a refused one: the client would be
 * left reading a kilo goal against a pound trend with no way to tell which is
 * which.
 */
export function convertUnits(state: UnitScopedState, to: Units): UnitScopedState | null {
  const { profile } = state
  if (profile.units === to) return state

  const toWeight = to === 'kg' ? lbToKg : kgToLb
  const toLength = to === 'kg' ? inToCm : cmToIn
  const increment = convertIncrement(profile.roundingIncrement, to)

  let failed = false
  const convert = (
    transform: (v: number) => number,
    value: number,
    decimals: number,
  ): number => {
    const next = places(transform(value), decimals)
    if (!Number.isFinite(next)) failed = true
    return next
  }
  /** A weight as recorded or displayed: one decimal, the app's own precision. */
  const recorded = (value: number) => convert(toWeight, value, 1)
  /** A tape reading: a length, so inches and centimetres — never pounds. */
  const tape = (value: number) => convert(toLength, value, 1)
  /** Kit the programme loads a bar from, so it has to sit on the new gym's grid. */
  const snapped = (value: number, step: number) => {
    const next = roundToIncrement(toWeight(value), step)
    if (!Number.isFinite(next)) failed = true
    return next
  }

  const rate = convert(toWeight, profile.weeklyRateTarget, 2)
  const nextProfile: Profile = {
    ...profile,
    units: to,
    // Height is stored in inches whatever the weight unit — the field name and
    // the feet-and-inches display both say so — and is never read as a weight.
    startWeight: recorded(profile.startWeight),
    goalWeight: recorded(profile.goalWeight),
    // The rate is shown to two decimals, so it is kept to two: a tenth of a kilo
    // a week is a 25% error on a rate a coach sets food by.
    weeklyRateTarget: rate,
    goalLabel: convertGoalLabel(profile.goalLabel, rate, to),
    trainingMaxes: Object.fromEntries(
      Object.entries(profile.trainingMaxes).map(([id, max]) => [id, snapped(max, increment)]),
    ),
    barWeight: snapped(profile.barWeight, BAR_STEP[to]),
    availablePlates: convertPlates(profile.availablePlates, to),
    roundingIncrement: increment,
  }

  const convertSets = (sets: LoggedSet[]): LoggedSet[] =>
    sets.map((s) => ({ ...s, weight: recorded(s.weight) }))

  const next: UnitScopedState = {
    profile: nextProfile,
    weighIns: state.weighIns.map((w) => ({ ...w, weight: recorded(w.weight) })),
    measurements: state.measurements.map((m) => {
      const out: MeasurementEntry = { ...m }
      // Per field, not per record: a circumference is a length, and body fat is
      // a percentage that means the same thing in either unit.
      for (const site of ['waist', 'chest', 'hips', 'arm', 'thigh', 'neck'] as const) {
        const value = out[site]
        if (value != null) out[site] = tape(value)
      }
      return out
    }),
    // A check-in can reach storage without a weight, through an import that had
    // none. Absent is not unconvertible, so it passes through untouched.
    checkIns: state.checkIns.map((c) =>
      c.weight == null ? c : { ...c, weight: recorded(c.weight) },
    ),
    logs: state.logs.map((log) => ({
      ...log,
      exercises: log.exercises.map((ex) => ({ ...ex, sets: convertSets(ex.sets) })),
    })),
    active: state.active
      ? {
          ...state.active,
          entries: Object.fromEntries(
            Object.entries(state.active.entries).map(([id, sets]) => [id, convertSets(sets)]),
          ),
        }
      : null,
  }

  return failed ? null : next
}
