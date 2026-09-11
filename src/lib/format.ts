import type { Units } from '../domain/types'

/** Trim trailing zeros: 225.0 → "225", 182.5 → "182.5". */
export function num(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Number(value.toFixed(maxDecimals))
  return String(rounded)
}

/**
 * A unit agreeing with its quantity: "1 cake", not "1 cakes".
 *
 * Only count words are touched. Weights and volumes are abbreviations that never
 * inflect, and none of them end in "s" anyway.
 */
export function unitFor(qty: number, unit: string): string {
  if (Math.abs(qty) === 1 && unit.length > 2 && unit.endsWith('s') && !unit.endsWith('ss')) {
    return unit.slice(0, -1)
  }
  return unit
}

/** An estimate of 0 means "nothing here supports one", so it shows as a dash. */
export function estimate(value: number): string {
  return value > 0 ? num(value, 0) : '—'
}

/** Always shows `decimals` places, so a column of weights stays aligned. */
export function fixed(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(decimals)
}

export function signed(value: number, maxDecimals = 1): string {
  const n = num(Math.abs(value), maxDecimals)
  if (Math.abs(value) < Math.pow(10, -maxDecimals) / 2) return n
  return `${value > 0 ? '+' : '−'}${n}`
}

export const weight = (value: number, units: Units, decimals = 1): string =>
  `${num(value, decimals)} ${units}`

export const kcal = (value: number): string => `${Math.round(value)}`

export const grams = (value: number): string => `${Math.round(value)}g`

export function percent(value: number, decimals = 0): string {
  return `${num(value, decimals)}%`
}

/** 12500 → "12.5k" */
export function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${num(value / 1_000_000, 1)}M`
  if (Math.abs(value) >= 1000) return `${num(value / 1000, 1)}k`
  return num(value, 0)
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Whether a value reads as data rather than as language, so a primitive can set
 * it in the data face without every call site saying so.
 *
 * The test is the first character, which is all it takes: "315 lb", "+0.4", "8
 * weeks" and "—" are figures; "Match iPhone" and "Jud Whitfield" are not. A dash
 * counts because it is a figure with nothing in it yet, and a column of numbers
 * must not change face where one of them is missing.
 */
export function readsAsFigure(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  const first = value.trim()[0]
  return first != null && (/[\d.+]/.test(first) || '-−–—'.includes(first))
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
