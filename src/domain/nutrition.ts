/* ============================================================================
   Nutrition math
   ========================================================================== */

import type { DayNutrition, FoodItem, MacroTargets, Meal, MealPlan } from './types'

export interface MacroTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const

export function foodTotals(items: FoodItem[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (acc, f) => ({
      kcal: acc.kcal + f.kcal,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
      fiber: acc.fiber,
    }),
    { ...EMPTY_TOTALS },
  )
}

/** The multiplier applied to a planned food today; 1 unless it was adjusted. */
export function portionOf(day: DayNutrition, foodId: string): number {
  return day.portions?.[foodId] ?? 1
}

/** A food item scaled to the portion actually eaten. */
export function scaleFood(item: FoodItem, multiplier: number): FoodItem {
  if (multiplier === 1) return item
  const round = (v: number) => Math.round(v * multiplier)
  return {
    ...item,
    qty: Math.round(item.qty * multiplier * 100) / 100,
    kcal: round(item.kcal),
    protein: round(item.protein),
    carbs: round(item.carbs),
    fat: round(item.fat),
  }
}

/** What the client has actually eaten today: ticked plan items plus extras. */
export function consumedTotals(plan: MealPlan, day: DayNutrition): MacroTotals {
  const eaten: FoodItem[] = []
  for (const meal of plan.meals) {
    if (day.skippedMeals.includes(meal.id)) continue
    for (const item of meal.items) {
      if (day.checked[item.id]) eaten.push(scaleFood(item, portionOf(day, item.id)))
    }
  }
  return foodTotals([...eaten, ...day.extras])
}

/** A meal's totals as planned for today, portion adjustments included. */
export function plannedMealTotals(meal: Meal, day: DayNutrition): MacroTotals {
  return foodTotals(meal.items.map((i) => scaleFood(i, portionOf(day, i.id))))
}

export function remaining(targets: MacroTargets, totals: MacroTotals): MacroTotals {
  return {
    kcal: targets.kcal - totals.kcal,
    protein: targets.protein - totals.protein,
    carbs: targets.carbs - totals.carbs,
    fat: targets.fat - totals.fat,
    fiber: targets.fiber - totals.fiber,
  }
}

/** Calories implied by the macro split — catches a plan that doesn't add up. */
export function kcalFromMacros(t: Pick<MacroTargets, 'protein' | 'carbs' | 'fat'>): number {
  return t.protein * KCAL_PER_G.protein + t.carbs * KCAL_PER_G.carbs + t.fat * KCAL_PER_G.fat
}

export function macroSplitPercent(t: Pick<MacroTargets, 'protein' | 'carbs' | 'fat'>) {
  const total = kcalFromMacros(t) || 1
  return {
    protein: Math.round(((t.protein * 4) / total) * 100),
    carbs: Math.round(((t.carbs * 4) / total) * 100),
    fat: Math.round(((t.fat * 9) / total) * 100),
  }
}

/** How close a swap is to the food it replaces — surfaced in the swap sheet. */
export function swapDelta(original: FoodItem, swap: Omit<FoodItem, 'swaps'>) {
  return {
    kcal: swap.kcal - original.kcal,
    protein: swap.protein - original.protein,
    carbs: swap.carbs - original.carbs,
    fat: swap.fat - original.fat,
  }
}

export function isCloseSwap(original: FoodItem, swap: Omit<FoodItem, 'swaps'>): boolean {
  const d = swapDelta(original, swap)
  return Math.abs(d.kcal) <= 40 && Math.abs(d.protein) <= 6
}

/* ------------------------------ grocery list ---------------------------- */

export interface GroceryLine {
  name: string
  unit: string
  qty: number
  /** How many meals across the week draw on this item. */
  uses: number
}

/** Roll the plan's foods up into a shopping list for `days` days. */
export function groceryList(plan: MealPlan, days = 7): GroceryLine[] {
  const map = new Map<string, GroceryLine>()
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      const key = `${item.name.toLowerCase()}|${item.unit}`
      const existing = map.get(key)
      if (existing) {
        existing.qty += item.qty * days
        existing.uses += 1
      } else {
        map.set(key, { name: item.name, unit: item.unit, qty: item.qty * days, uses: 1 })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/* ------------------------------- adherence ------------------------------ */

/** Percentage of planned items ticked off, 0..100. */
export function adherencePercent(plan: MealPlan, day: DayNutrition): number {
  const planned = plan.meals
    .filter((m) => !day.skippedMeals.includes(m.id))
    .flatMap((m) => m.items)
  if (planned.length === 0) return 0
  const done = planned.filter((i) => day.checked[i.id]).length
  return Math.round((done / planned.length) * 100)
}

/** Protein is the macro that matters most — flag it separately. */
export function proteinStatus(targets: MacroTargets, totals: MacroTotals) {
  const pct = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0
  if (pct >= 95) return { status: 'good' as const, label: 'Protein hit' }
  if (pct >= 70) return { status: 'warn' as const, label: 'Protein close' }
  return { status: 'bad' as const, label: 'Protein short' }
}
