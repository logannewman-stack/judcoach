import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { SwipeRow, useSwipeGroup } from '../../components/ios/SwipeRow'
import { RingStack, MACRO_COLORS } from '../../components/Rings'
import { toast } from '../../components/ios/Toast'
import { useStore, emptyDay } from '../../store/useStore'
import { useProgram, weekSchedule, currentWeekIndex } from '../../store/selectors'
import { MEAL_PLAN, QUICK_ADDS } from '../../data/mealPlan'
import type { FoodItem, MacroTargets, Meal } from '../../domain/types'
import {
  adherencePercent, consumedTotals, foodTotals, mealTotals, proteinStatus,
} from '../../domain/nutrition'
import { addDays, formatClock, relativeDay, todayISO } from '../../lib/date'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

type DayMode = 'training' | 'rest'

export function MealsHome() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const push = useNav((s) => s.push)
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const nutrition = useStore((s) => s.nutrition)
  const toggleFood = useStore((s) => s.toggleFood)
  const checkAllInMeal = useStore((s) => s.checkAllInMeal)
  const setWater = useStore((s) => s.setWater)
  const removeExtraFood = useStore((s) => s.removeExtraFood)

  const day = nutrition[date] ?? emptyDay(date)

  // A day with a session scheduled gets the higher-carb targets.
  const isTrainingDay = useMemo(() => {
    const wi = currentWeekIndex(program, date)
    return weekSchedule(program, wi, logs).some((s) => s.date === date)
  }, [program, logs, date])
  const [override, setOverride] = useState<DayMode | null>(null)
  const mode: DayMode = override ?? (isTrainingDay ? 'training' : 'rest')
  const targets: MacroTargets =
    mode === 'rest' && MEAL_PLAN.restDayTargets ? MEAL_PLAN.restDayTargets : MEAL_PLAN.targets

  const totals = consumedTotals(MEAL_PLAN, day)
  const adherence = adherencePercent(MEAL_PLAN, day)
  const protein = proteinStatus(targets, totals)
  const [quickAdd, setQuickAdd] = useState(false)
  const swipe = useSwipeGroup()

  return (
    <Screen
      title="Meals"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim truncate">{MEAL_PLAN.name}</div>
        </div>
      }
      right={{ icon: 'list', onPress: () => push('grocery'), ariaLabel: 'Grocery list' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* ------------------------------ day picker ------------------------- */}
        <div className="gutter" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDate((d) => addDays(d, -1))}
            style={arrowBtn}
          >
            <Icon name="chevron.left" size={16} weight={2.6} />
          </button>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div className="t-headline truncate">{relativeDay(date, today)}</div>
            <div className="t-caption1 dim">{mode === 'training' ? 'Training day' : 'Rest day'} targets</div>
          </div>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setDate((d) => (d < today ? addDays(d, 1) : d))}
            disabled={date >= today}
            style={{ ...arrowBtn, opacity: date >= today ? 0.35 : 1 }}
          >
            <Icon name="chevron.right" size={16} weight={2.6} />
          </button>
        </div>

        {/* -------------------------------- rings ---------------------------- */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <RingStack
              size={122}
              thickness={12}
              gap={4}
              rings={[
                { value: totals.protein, target: targets.protein, color: MACRO_COLORS.protein },
                { value: totals.carbs, target: targets.carbs, color: MACRO_COLORS.carbs },
                { value: totals.fat, target: targets.fat, color: MACRO_COLORS.fat },
              ]}
            >
              <div style={{ lineHeight: 1 }}>
                <div className="mono-nums bold" style={{ fontSize: 23, letterSpacing: -0.6 }}>
                  {Math.round(totals.kcal)}
                </div>
                <div className="t-caption2 dim" style={{ marginTop: 3 }}>
                  of {targets.kcal}
                </div>
              </div>
            </RingStack>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MacroReadout label="Protein" value={totals.protein} target={targets.protein} color={MACRO_COLORS.protein} />
              <MacroReadout label="Carbs" value={totals.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} />
              <MacroReadout label="Fat" value={totals.fat} target={targets.fat} color={MACRO_COLORS.fat} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
            <Pill tone={protein.status}>{protein.label}</Pill>
            <Pill tone={adherence >= 80 ? 'good' : adherence >= 50 ? 'warn' : 'default'}>
              {adherence}% of plan
            </Pill>
            <Pill>{Math.max(0, Math.round(targets.kcal - totals.kcal))} kcal left</Pill>
          </div>

          <div style={{ marginTop: 14 }}>
            <Segmented
              options={[
                { value: 'training', label: 'Training day' },
                { value: 'rest', label: 'Rest day' },
              ]}
              value={mode}
              onChange={(v) => setOverride(v as DayMode)}
            />
          </div>
        </Card>

        {/* -------------------------------- water ---------------------------- */}
        <div>
          <SectionHeader title="Water" />
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="drop.fill" size={22} color={MACRO_COLORS.water} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono-nums t-headline">
                  {day.waterOz} <span className="dim" style={{ fontWeight: 400 }}>/ {targets.waterOz} oz</span>
                </div>
                <div className="track" style={{ marginTop: 6 }}>
                  <motion.div
                    className="track-fill"
                    style={{ background: MACRO_COLORS.water }}
                    initial={false}
                    animate={{ width: `${Math.min(100, (day.waterOz / targets.waterOz) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  />
                </div>
              </div>
              <button
                type="button"
                aria-label="Add 16 ounces"
                onClick={() => {
                  haptic('light')
                  setWater(date, day.waterOz + 16)
                }}
                className="btn btn-tinted btn-sm"
                style={{ flex: 'none' }}
              >
                +16 oz
              </button>
            </div>
          </Card>
        </div>

        {/* -------------------------------- meals ---------------------------- */}
        <div>
          <SectionHeader
            title="Today's meals"
            action={{ label: 'Guidelines', onPress: () => push('guidelines') }}
          />
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {MEAL_PLAN.meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                checked={day.checked}
                skipped={day.skippedMeals.includes(meal.id)}
                onToggleItem={(id) => toggleFood(date, id)}
                onCheckAll={(v) => checkAllInMeal(date, meal.items.map((i) => i.id), v)}
                onOpen={() => push('mealDetail', { mealId: meal.id, date })}
              />
            ))}
          </div>
        </div>

        {/* -------------------------------- extras --------------------------- */}
        <ListSection
          header="Extras"
          footer="Anything off-plan. Log it honestly — it's what tells Jud whether the plan is working."
        >
          {day.extras.map((food) => (
            <SwipeRow
              key={food.id}
              id={food.id}
              openId={swipe.openId}
              onOpenChange={swipe.onOpenChange}
              actions={[
                {
                  label: 'Remove',
                  icon: 'trash',
                  destructive: true,
                  onPress: () => removeExtraFood(date, food.id),
                },
              ]}
            >
              <Row
                title={food.name}
                subtitle={`${food.kcal} kcal · P${food.protein} C${food.carbs} F${food.fat}`}
                trailing={
                  <button
                    type="button"
                    aria-label={`Remove ${food.name}`}
                    onClick={() => removeExtraFood(date, food.id)}
                  >
                    <Icon name="xmark.circle.fill" size={20} color="var(--label-3)" />
                  </button>
                }
              />
            </SwipeRow>
          ))}
          <Row
            title="Add food"
            icon="plus"
            iconColor="var(--accent)"
            tinted
            onPress={() => setQuickAdd(true)}
          />
        </ListSection>
      </div>

      <QuickAddSheet
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        date={date}
      />
    </Screen>
  )
}

const arrowBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: '50%', flex: 'none',
  background: 'var(--fill-3)', color: 'var(--label)',
  display: 'grid', placeItems: 'center',
}

function MacroReadout({
  label, value, target, color,
}: {
  label: string
  value: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="t-footnote semibold" style={{ color }}>{label}</span>
        <span className="t-footnote mono-nums semibold">
          {Math.round(value)}
          <span className="dim" style={{ fontWeight: 400 }}>/{Math.round(target)}g</span>
        </span>
      </div>
      <div className="track" style={{ height: 5, marginTop: 4 }}>
        <motion.div
          className="track-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

function MealCard({
  meal, checked, skipped, onToggleItem, onCheckAll, onOpen,
}: {
  meal: Meal
  checked: Record<string, boolean>
  skipped: boolean
  onToggleItem: (id: string) => void
  onCheckAll: (value: boolean) => void
  onOpen: () => void
}) {
  const totals = mealTotals(meal)
  const doneCount = meal.items.filter((i) => checked[i.id]).length
  const allDone = doneCount === meal.items.length

  return (
    <div className="card" style={{ margin: 0, opacity: skipped ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px 11px' }}>
        <button
          type="button"
          aria-label={allDone ? `Uncheck ${meal.name}` : `Check off ${meal.name}`}
          onClick={() => {
            haptic(allDone ? 'light' : 'success')
            onCheckAll(!allDone)
          }}
          style={{
            width: 30, height: 30, borderRadius: '50%', flex: 'none',
            display: 'grid', placeItems: 'center',
            background: allDone ? 'var(--green)' : 'transparent',
            border: allDone ? 'none' : '2px solid var(--label-3)',
          }}
        >
          {allDone && <Icon name="check" size={16} weight={3} color="#fff" />}
        </button>

        <button type="button" onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="t-headline">{meal.name}</span>
            <span className="t-caption1 dim">{formatClock(meal.time)}</span>
          </div>
          <div className="t-footnote dim mono-nums">
            {totals.kcal} kcal · P{totals.protein} C{totals.carbs} F{totals.fat}
          </div>
        </button>

        <span className="t-caption1 dim mono-nums" style={{ flex: 'none' }}>
          {doneCount}/{meal.items.length}
        </span>
        <button type="button" aria-label={`Open ${meal.name}`} onClick={onOpen}>
          <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
        </button>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        {meal.items.map((item) => (
          <FoodLine
            key={item.id}
            item={item}
            checked={!!checked[item.id]}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function FoodLine({
  item, checked, onToggle, onSwap,
}: {
  item: FoodItem
  checked: boolean
  onToggle: () => void
  onSwap?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <button
        type="button"
        aria-label={checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
        onClick={() => {
          haptic('selection')
          onToggle()
        }}
        style={{
          width: 21, height: 21, borderRadius: '50%', flex: 'none',
          display: 'grid', placeItems: 'center',
          background: checked ? 'var(--accent)' : 'transparent',
          border: checked ? 'none' : '1.8px solid var(--label-3)',
        }}
      >
        {checked && <Icon name="check" size={12} weight={3.2} color="#fff" />}
      </button>
      <span
        className="t-subhead truncate"
        style={{
          flex: 1,
          minWidth: 0,
          textDecoration: checked ? 'line-through' : 'none',
          color: checked ? 'var(--label-3)' : 'var(--label)',
        }}
      >
        {item.name}
        <span className="dim3"> · {num(item.qty, 1)} {item.unit}</span>
      </span>
      {onSwap && item.swaps && item.swaps.length > 0 && (
        <button type="button" aria-label={`Swap ${item.name}`} onClick={onSwap} style={{ flex: 'none' }}>
          <Icon name="swap" size={16} weight={2.2} color="var(--accent)" />
        </button>
      )}
      <span className="t-caption1 dim mono-nums" style={{ flex: 'none' }}>
        {item.kcal}
      </span>
    </div>
  )
}

function QuickAddSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const addExtraFood = useStore((s) => s.addExtraFood)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add food"
      left={{ label: 'Close', onPress: onClose }}
      detent={0.7}
    >
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="t-footnote dim" style={{ marginBottom: 12 }}>
          Quick adds for the things that turn up most often.
        </div>
        {QUICK_ADDS.map((food) => (
          <button
            key={food.id}
            type="button"
            className="row"
            style={{ borderRadius: 10 }}
            onClick={() => {
              const { id: _id, ...rest } = food
              addExtraFood(date, rest)
              haptic('success')
              toast(`${food.name} added`, { icon: 'plus' })
              onClose()
            }}
          >
            <span className="row-body">
              <span className="row-title">{food.name}</span>
              <span className="row-sub mono-nums">
                {food.kcal} kcal · P{food.protein} C{food.carbs} F{food.fat}
              </span>
            </span>
            <Icon name="plus" size={18} weight={2.4} color="var(--accent)" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export { foodTotals }
