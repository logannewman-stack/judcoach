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
      fiber: acc.fiber + (f.fiber ?? 0),
    }),
    { ...EMPTY_TOTALS },
  )
}

/**
 * The multiplier applied to a planned food today.
 *
 * A client's own adjustment always wins. Failing that, a rest day falls back to
 * the plan's rest-day portions — otherwise the app names a lower rest-day
 * target and then serves the full training-day plan against it.
 */
export function portionOf(
  day: DayNutrition,
  foodId: string,
  plan?: MealPlan,
  restDay = false,
): number {
  const explicit = day.portions?.[foodId]
  if (explicit != null) return explicit
  if (restDay && plan?.restDayPortions?.[foodId] != null) return plan.restDayPortions[foodId]!
  return 1
}

/**
 * A food item scaled to the portion actually eaten.
 *
 * Macros keep a decimal and calories are re-derived from them where the food
 * reconciles at 4/4/9. Rounding each field independently let the calorie ring
 * and the macro rings disagree by ~70 kcal on a half-portion day.
 */
export function scaleFood(item: FoodItem, multiplier: number): FoodItem {
  if (multiplier === 1) return item
  const tenth = (v: number) => Math.round(v * multiplier * 10) / 10
  const protein = tenth(item.protein)
  const carbs = tenth(item.carbs)
  const fat = tenth(item.fat)
  const derived = protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat
  const reconciles =
    Math.abs(
      item.protein * KCAL_PER_G.protein + item.carbs * KCAL_PER_G.carbs + item.fat * KCAL_PER_G.fat
        - item.kcal,
    ) <= 3
  return {
    ...item,
    qty: Math.round(item.qty * multiplier * 100) / 100,
    // Alcohol and trace-calorie foods don't reconcile at 4/4/9; scale those.
    kcal: Math.round(reconciles ? derived : item.kcal * multiplier),
    protein,
    carbs,
    fat,
    fiber: item.fiber == null ? undefined : tenth(item.fiber),
  }
}

/** What the client has actually eaten today: ticked plan items plus extras. */
export function consumedTotals(plan: MealPlan, day: DayNutrition, restDay = false): MacroTotals {
  const eaten: FoodItem[] = []
  for (const meal of plan.meals) {
    if (day.skippedMeals.includes(meal.id)) continue
    for (const item of meal.items) {
      if (day.checked[item.id]) eaten.push(scaleFood(item, portionOf(day, item.id, plan, restDay)))
    }
  }
  return foodTotals([...eaten, ...day.extras])
}

/** A meal's totals as planned for today, portion adjustments included. */
export function plannedMealTotals(
  meal: Meal,
  day: DayNutrition,
  plan?: MealPlan,
  restDay = false,
): MacroTotals {
  return foodTotals(meal.items.map((i) => scaleFood(i, portionOf(day, i.id, plan, restDay))))
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

/**
 * How much of the plan was actually eaten, 0..100.
 *
 * Counting ticks alone made a quarter portion of everything, and skipping five
 * of six meals, both read as 100%: a skipped meal used to leave the denominator
 * along with the numerator. Portions are weighted and skipped meals stay in the
 * denominator, so the number tracks food rather than taps.
 */
export function adherencePercent(plan: MealPlan, day: DayNutrition, restDay = false): number {
  const planned = plan.meals.flatMap((m) => m.items)
  if (planned.length === 0) return 0
  const eaten = plan.meals.reduce((sum, meal) => {
    if (day.skippedMeals.includes(meal.id)) return sum
    return sum + meal.items.reduce((n, item) => {
      if (!day.checked[item.id]) return n
      const target = restDay ? (plan.restDayPortions?.[item.id] ?? 1) : 1
      return n + Math.min(1, portionOf(day, item.id, plan, restDay) / target)
    }, 0)
  }, 0)
  return Math.round((eaten / planned.length) * 100)
}

/**
 * Whether the protein target has been met, in the whole grams the card prints.
 *
 * One rule, because the Meals card makes three statements about protein at once:
 * a pill, the colour of the bar, and the line counting what is still owed. A
 * "hit" at 95% of target put "Protein hit" beside "243/247 g" and "4 g of
 * protein still to go" — the target announced as met by the one signal that had
 * stopped counting. Whole grams because that is the readout's own unit: half a
 * gram short reads "247/247 g" on screen, and nothing beside it should still be
 * asking for more.
 */
export function proteinMet(targets: MacroTargets, totals: MacroTotals): boolean {
  return targets.protein > 0 && Math.round(targets.protein - totals.protein) <= 0
}

/** Protein is the macro that matters most — flag it separately. */
export function proteinStatus(targets: MacroTargets, totals: MacroTotals) {
  if (proteinMet(targets, totals)) return { status: 'good' as const, label: 'Protein hit' }
  const pct = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0
  if (pct >= 70) return { status: 'warn' as const, label: 'Protein close' }
  return { status: 'bad' as const, label: 'Protein short' }
}
