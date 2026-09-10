import type { Units } from '../domain/types'

/** Trim trailing zeros: 225.0 → "225", 182.5 → "182.5". */
export function num(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Number(value.toFixed(maxDecimals))
  return String(rounded)
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

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
