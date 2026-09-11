import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { MACRO_COLORS, RingStack } from '../../components/Rings'
import { macroSplitPercent, proteinMet } from '../../domain/nutrition'
import type { MacroTotals } from '../../domain/nutrition'
import type { MacroTargets } from '../../domain/types'
import '../../styles/fuel.css'

/* ============================================================================
   The fuel card: the day's calories as a ring stack, and the three macros
   beside it.

   Today used to draw its own — a 7px bar on a different grey, a different label
   face, no space in front of the "g", no slack on the calorie count, and the
   opposite verdict once a target was passed. The two cards therefore disagreed
   about the same three numbers: the rings said all three had landed while the
   bars four pixels to the right said all three were over. One component that
   both screens render is the only arrangement in which that cannot happen
   again.
   ========================================================================== */

/**
 * How far past a target still counts as hitting it.
 *
 * The plan's own meals sum to 2921 kcal against a 2920 kcal target, so a client
 * who followed it exactly was being told on Today that they had gone over, in
 * the warning colour, under three rings reporting the day as perfect. Grams get
 * a proportional tolerance instead of a fixed one: a gram either side of 247 is
 * what a rounded readout and a set of kitchen scales disagree by, not an
 * overshoot, while 2% of the calorie target would be a whole meal.
 */
const KCAL_SLACK = 5
const MACRO_SLACK = 0.02

/** Short of the target, on it, or past it by more than the slack allows. */
type MacroState = 'under' | 'met' | 'over'

/**
 * Met in the whole units the readout prints — half a gram short reads
 * "247/247 g" on screen, and nothing beside it should still be asking for more.
 * This is `proteinMet`'s rule generalised to the other two macros; protein
 * itself routes through the domain's own copy, so the pill, the bar and the
 * line counting what is owed cannot drift apart.
 */
const metInWholeUnits = (value: number, target: number) =>
  target > 0 && Math.round(target - value) <= 0

function macroState(value: number, target: number, met: boolean): MacroState {
  if (target <= 0) return 'under'
  if (value > target * (1 + MACRO_SLACK)) return 'over'
  return met ? 'met' : 'under'
}

/** Where the day's calories stand, with the slack applied once for everyone. */
export function kcalStanding(targets: MacroTargets, totals: MacroTotals): {
  /** Still owed; negative once the day is over target. */
  left: number
  state: MacroState
} {
  const left = Math.round(targets.kcal - totals.kcal)
  return {
    left,
    state: left < -KCAL_SLACK ? 'over' : left <= KCAL_SLACK ? 'met' : 'under',
  }
}

/**
 * One macro beside the rings: the name as an eyebrow, the figure and its target
 * as one object, and a bar in the macro's own hue.
 *
 * The hue stays the macro's in every state it is still within, so the three
 * bars can always be told apart; a target passed by more than the slack is the
 * one thing that repaints it, in the warning colour the rest of the app uses
 * for "this went further than the plan said".
 */
function MacroRow({
  label, value, target, color, met,
}: {
  label: string
  value: number
  target: number
  color: string
  met: boolean
}) {
  const state = macroState(value, target, met)
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div
      className="macro-row"
      data-state={state}
      // Resolved here rather than in a rule keyed off data-state: an inline
      // custom property outranks any stylesheet, so the over colour had to win
      // in the same place the macro's own hue is set.
      style={{ '--macro': state === 'over' ? 'var(--orange)' : color } as CSSProperties}
    >
      <div className="macro-head">
        <span className="eyebrow macro-name">{label}</span>
        <span className="data macro-value">
          {Math.round(value)}
          <span className="macro-target">/{Math.round(target)} g</span>
        </span>
      </div>
      <div className="macro-bar">
        <motion.div
          className="macro-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

/**
 * The day's fuel: calories in the hole of the ring stack, macros beside it.
 *
 * 10pt arcs on a 122pt stack leave a 48pt hole, which is what a four-digit
 * calorie count and its target need. At the 12pt the rings were once drawn at,
 * both strings crossed the innermost arc.
 */
export function FuelReadout({ targets, totals }: { targets: MacroTargets; totals: MacroTotals }) {
  const macros = [
    {
      label: 'Protein',
      value: totals.protein,
      target: targets.protein,
      color: MACRO_COLORS.protein,
      met: proteinMet(targets, totals),
    },
    {
      label: 'Carbs',
      value: totals.carbs,
      target: targets.carbs,
      color: MACRO_COLORS.carbs,
      met: metInWholeUnits(totals.carbs, targets.carbs),
    },
    {
      label: 'Fat',
      value: totals.fat,
      target: targets.fat,
      color: MACRO_COLORS.fat,
      met: metInWholeUnits(totals.fat, targets.fat),
    },
  ]

  return (
    <div className="fuel-readout">
      <RingStack
        size={122}
        thickness={10}
        gap={3.5}
        rings={macros.map((m) => ({
          value: m.value,
          target: m.target,
          color: macroState(m.value, m.target, m.met) === 'over' ? 'var(--orange)' : m.color,
        }))}
      >
        <div className="fuel-centre">
          <div className="figure fuel-kcal">{Math.round(totals.kcal)}</div>
          <div className="data fuel-kcal-target">of {targets.kcal}</div>
        </div>
      </RingStack>

      <div className="fuel-macros">
        {macros.map((m) => <MacroRow key={m.label} {...m} />)}
      </div>
    </div>
  )
}

/* ----------------------------- the macro split ----------------------------
   Where a set of calories comes from, as one bar in the three hues.

   The guidelines screen had this; a meal and a week's shop are the same
   question asked of a smaller set of numbers, and three flat pills saying
   "P 43g C 55g F 18g" answered it in a register nobody reads. It is also, on
   three screens that were otherwise white paper and hairlines, the only thing
   with a colour in it.
   ------------------------------------------------------------------------ */

const SPLIT_KEYS = [
  { key: 'protein', label: 'Protein', color: MACRO_COLORS.protein, ink: 'var(--fuel-1-text)' },
  { key: 'carbs', label: 'Carbs', color: MACRO_COLORS.carbs, ink: 'var(--fuel-2-text)' },
  { key: 'fat', label: 'Fat', color: MACRO_COLORS.fat, ink: 'var(--fuel-3-text)' },
] as const

/** The grams are a day's, a meal's or a week's shopping — the split is the same. */
export function MacroSplit({ macros }: { macros: { protein: number; carbs: number; fat: number } }) {
  const split = macroSplitPercent(macros)
  return (
    <>
      <div className="macro-split-bar">
        {SPLIT_KEYS.map((k) => (
          <span key={k.key} style={{ width: `${split[k.key]}%`, background: k.color }} />
        ))}
      </div>
      <div className="macro-split-legend">
        {SPLIT_KEYS.map((k) => (
          <div key={k.key} className="macro-split-key">
            <div className="macro-split-head">
              <span className="macro-split-dot" style={{ background: k.color }} />
              <span className="eyebrow truncate">{k.label}</span>
            </div>
            <div className="data macro-split-pct" style={{ color: k.ink }}>{split[k.key]}%</div>
            <div className="data macro-split-grams">
              {Math.round(macros[k.key])}<span className="data-unit"> g</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
