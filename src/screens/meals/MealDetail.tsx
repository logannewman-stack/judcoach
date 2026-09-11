import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { FoodLine, MacroLine } from './MealsHome'
import { useDayMode } from './dayMode'
import { useStore, emptyDay } from '../../store/useStore'
import { MEAL_PLAN } from '../../data/mealPlan'
import type { FoodItem } from '../../domain/types'
import { isCloseSwap, plannedMealTotals, portionOf, scaleFood, swapDelta } from '../../domain/nutrition'
import { formatClock, relativeDay } from '../../lib/date'
import { num, signed, unitFor } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

export function MealDetail({ mealId, date }: { mealId: string; date: string }) {
  const pop = useNav((s) => s.pop)
  const nutrition = useStore((s) => s.nutrition)
  const toggleFood = useStore((s) => s.toggleFood)
  const setMealSkipped = useStore((s) => s.setMealSkipped)
  const addExtraFood = useStore((s) => s.addExtraFood)
  const [swapping, setSwapping] = useState<FoodItem | null>(null)
  const [portioning, setPortioning] = useState<FoodItem | null>(null)
  const setPortion = useStore((s) => s.setPortion)

  const meal = MEAL_PLAN.meals.find((m) => m.id === mealId)
  const day = nutrition[date] ?? emptyDay(date)
  // Has to agree with the meals list: these rows are what a client actually
  // measures out, so a rest day here must serve the rest day's amounts.
  const restDay = useDayMode(date) === 'rest'

  if (!meal) {
    return (
      <Screen title="Meal" back={{ onPress: pop }}>
        <div className="gutter t-body dim">This meal is no longer in your plan.</div>
      </Screen>
    )
  }

  const totals = plannedMealTotals(meal, day, MEAL_PLAN, restDay)
  const skipped = day.skippedMeals.includes(meal.id)

  return (
    <Screen
      title={meal.name}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">{relativeDay(date)} · {formatClock(meal.time)}</div>
          {meal.note && <div className="t-subhead dim" style={{ marginTop: 2 }}>{meal.note}</div>}
          <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
            <Pill tone="tinted"><span className="data">{totals.kcal} kcal</span></Pill>
            <Pill><span className="data">P {totals.protein}g</span></Pill>
            <Pill><span className="data">C {totals.carbs}g</span></Pill>
            <Pill><span className="data">F {totals.fat}g</span></Pill>
          </div>
        </div>
      }
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <SectionHeader title="Foods" />
          {/* No extra padding around the rows: FoodLine owns the 44pt pitch
              that keeps the touch targets from colliding. */}
          <Card>
            {meal.items.map((item) => (
              <FoodLine
                key={item.id}
                item={item}
                portion={portionOf(day, item.id, MEAL_PLAN, restDay)}
                checked={!!day.checked[item.id]}
                onToggle={() => toggleFood(date, item.id)}
                onSwap={() => setSwapping(item)}
                onPortion={() => setPortioning(item)}
              />
            ))}
          </Card>
          <div className="list-footer">
            Tap a portion chip to log what you actually ate, or the swap arrow for
            macro-matched alternatives.
          </div>
        </div>

        <div className="gutter">
          <button
            type="button"
            className={`btn ${skipped ? 'btn-tinted' : 'btn-gray'}`}
            onClick={() => setMealSkipped(date, meal.id, !skipped)}
          >
            <Icon name={skipped ? 'reset' : 'xmark'} size={17} weight={2.2} />
            {skipped ? 'Un-skip this meal' : 'Skip this meal today'}
          </button>
          <div className="t-footnote dim" style={{ marginTop: 8 }}>
            A skipped meal drops out of your targets for the day.
          </div>
        </div>
      </div>

      <PortionSheet
        item={portioning}
        current={portioning ? portionOf(day, portioning.id, MEAL_PLAN, restDay) : 1}
        onClose={() => setPortioning(null)}
        onPick={(multiplier) => {
          if (portioning) setPortion(date, portioning.id, multiplier)
          setPortioning(null)
        }}
      />

      <SwapSheet
        item={swapping}
        onClose={() => setSwapping(null)}
        onPick={(swap) => {
          if (!swapping) return
          // Record the swap as an extra and untick the original, so the day's
          // macros reflect what was actually eaten.
          const { id: _id, ...rest } = swap
          addExtraFood(date, rest)
          if (day.checked[swapping.id]) toggleFood(date, swapping.id)
          toast(`Swapped to ${swap.name}`, { icon: 'swap' })
          setSwapping(null)
        }}
      />
    </Screen>
  )
}

function SwapSheet({
  item, onClose, onPick,
}: {
  item: FoodItem | null
  onClose: () => void
  onPick: (swap: Omit<FoodItem, 'swaps'>) => void
}) {
  if (!item) return null
  const swaps = item.swaps ?? []

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title="Swap"
      left={{ label: 'Cancel', onPress: onClose }}
      detent={0.7}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Replacing</div>
        <div className="t-headline">{item.name}</div>
        <div className="t-footnote dim" style={{ marginBottom: 16 }}>
          <span className="data" style={{ fontSize: 'inherit', fontWeight: 500 }}>
            {num(item.qty, 1)} {unitFor(item.qty, item.unit)}
            <span className="data-unit"> · </span>
          </span>
          <MacroLine food={item} />
        </div>

        {swaps.length === 0 ? (
          <div className="t-subhead dim">No swaps set for this one — message Jud if you need an option.</div>
        ) : (
          swaps.map((swap) => {
            const delta = swapDelta(item, swap)
            const close = isCloseSwap(item, swap)
            return (
              <button
                key={swap.id}
                type="button"
                className="row"
                style={{ borderRadius: 10 }}
                onClick={() => onPick(swap)}
              >
                <span className="row-body">
                  <span className="row-title">
                    {swap.name}
                    <span className="data dim" style={{ fontSize: 15, fontWeight: 500 }}>
                      {' · '}{num(swap.qty, 1)} {unitFor(swap.qty, swap.unit)}
                    </span>
                  </span>
                  <span className="row-sub">
                    <MacroLine food={swap} />
                    {(delta.kcal !== 0 || delta.protein !== 0) && (
                      <span
                        className="data"
                        style={{
                          fontSize: 'inherit',
                          fontWeight: 500,
                          color: close ? 'var(--label-2)' : 'var(--orange-text)',
                        }}
                      >
                        {' '}({signed(delta.kcal, 0)} kcal, {signed(delta.protein, 0)}g P)
                      </span>
                    )}
                  </span>
                </span>
                {close && <Pill tone="good">Match</Pill>}
              </button>
            )
          })
        )}
      </div>
    </Sheet>
  )
}

/* ------------------------------- portions -------------------------------- */

const PORTIONS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

function PortionSheet({
  item, current, onClose, onPick,
}: {
  item: FoodItem | null
  current: number
  onClose: () => void
  onPick: (multiplier: number) => void
}) {
  if (!item) return null
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title="Portion"
      left={{ label: 'Cancel', onPress: onClose }}
      detent={0.6}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="t-footnote dim" style={{ marginBottom: 3 }}>How much did you actually eat?</div>
        <div className="t-headline" style={{ marginBottom: 14 }}>{item.name}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {PORTIONS.map((p) => {
            const on = Math.abs(p - current) < 0.001
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  haptic('selection')
                  onPick(p)
                }}
                className="data"
                style={{
                  minHeight: 46,
                  borderRadius: 11,
                  fontSize: 17,
                  background: on ? 'var(--accent)' : 'var(--fill-4)',
                  color: on ? '#fff' : 'var(--label)',
                }}
              >
                {p === 0 ? 'None' : `${num(p, 2)}×`}
              </button>
            )
          })}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background: 'var(--fill-4)',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 5 }}>At this portion</div>
          <div className="data" style={{ fontSize: 17, lineHeight: '22px' }}>
            {num(scaleFood(item, current).qty, 2)} {unitFor(scaleFood(item, current).qty, item.unit)}
            <span className="data-unit"> · </span>
            <MacroLine food={scaleFood(item, current)} />
          </div>
        </div>
      </div>
    </Sheet>
  )
}
