import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { FoodLine } from './MealsHome'
import { useStore, emptyDay } from '../../store/useStore'
import { MEAL_PLAN } from '../../data/mealPlan'
import type { FoodItem } from '../../domain/types'
import { isCloseSwap, mealTotals, swapDelta } from '../../domain/nutrition'
import { formatClock, relativeDay } from '../../lib/date'
import { num, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'

export function MealDetail({ mealId, date }: { mealId: string; date: string }) {
  const pop = useNav((s) => s.pop)
  const nutrition = useStore((s) => s.nutrition)
  const toggleFood = useStore((s) => s.toggleFood)
  const setMealSkipped = useStore((s) => s.setMealSkipped)
  const addExtraFood = useStore((s) => s.addExtraFood)
  const [swapping, setSwapping] = useState<FoodItem | null>(null)

  const meal = MEAL_PLAN.meals.find((m) => m.id === mealId)
  const day = nutrition[date] ?? emptyDay(date)

  if (!meal) {
    return (
      <Screen title="Meal" back={{ onPress: pop }}>
        <div className="gutter t-body dim">This meal is no longer in your plan.</div>
      </Screen>
    )
  }

  const totals = mealTotals(meal)
  const skipped = day.skippedMeals.includes(meal.id)

  return (
    <Screen title={meal.name} back={{ label: 'Meals', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <div className="t-footnote dim">{relativeDay(date)} · {formatClock(meal.time)}</div>
          <h1 className="t-large-title" style={{ letterSpacing: -0.6, marginTop: 2 }}>{meal.name}</h1>
          {meal.note && <div className="t-subhead dim" style={{ marginTop: 3 }}>{meal.note}</div>}
          <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
            <Pill tone="tinted">{totals.kcal} kcal</Pill>
            <Pill>P {totals.protein}g</Pill>
            <Pill>C {totals.carbs}g</Pill>
            <Pill>F {totals.fat}g</Pill>
          </div>
        </div>

        <div>
          <SectionHeader title="Foods" />
          <Card>
            {meal.items.map((item) => (
              <div key={item.id} style={{ padding: '2px 0' }}>
                <FoodLine
                  item={item}
                  checked={!!day.checked[item.id]}
                  onToggle={() => toggleFood(date, item.id)}
                  onSwap={() => setSwapping(item)}
                />
              </div>
            ))}
          </Card>
          <div className="list-footer">
            Tap the swap arrow on any food to see macro-matched alternatives.
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
          <div className="t-footnote dim" style={{ marginTop: 8, textAlign: 'center' }}>
            A skipped meal drops out of your targets for the day.
          </div>
        </div>
      </div>

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
        <div className="t-footnote dim" style={{ marginBottom: 4 }}>Replacing</div>
        <div className="t-headline">{item.name}</div>
        <div className="t-footnote dim mono-nums" style={{ marginBottom: 16 }}>
          {num(item.qty, 1)} {item.unit} · {item.kcal} kcal · P{item.protein} C{item.carbs} F{item.fat}
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
                    <span className="dim"> · {num(swap.qty, 1)} {swap.unit}</span>
                  </span>
                  <span className="row-sub mono-nums">
                    {swap.kcal} kcal · P{swap.protein} C{swap.carbs} F{swap.fat}
                    {(delta.kcal !== 0 || delta.protein !== 0) && (
                      <span style={{ color: close ? 'var(--label-2)' : 'var(--orange)' }}>
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
