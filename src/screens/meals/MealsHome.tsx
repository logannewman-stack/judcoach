import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented, Stepper } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { SwipeRow, useSwipeGroup } from '../../components/ios/SwipeRow'
import { RingStack, MACRO_COLORS } from '../../components/Rings'
import { toast } from '../../components/ios/Toast'
import { useStore, emptyDay } from '../../store/useStore'
import { MEAL_PLAN, QUICK_ADDS } from '../../data/mealPlan'
import type { DayNutrition, FoodItem, MacroTargets, Meal } from '../../domain/types'
import {
  adherencePercent, consumedTotals, foodTotals, plannedMealTotals, portionOf, proteinStatus, scaleFood,
} from '../../domain/nutrition'
import {
  addDays, formatClock, formatMediumDate, fromISODate, relativeDay, todayISO, weekdayMin,
} from '../../lib/date'
import { num, unitFor } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'
import { useDayMode, useDayOverrides } from './dayMode'
import type { DayMode } from './dayMode'

export function MealsHome() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const push = useNav((s) => s.push)
  const nutrition = useStore((s) => s.nutrition)
  const toggleFood = useStore((s) => s.toggleFood)
  const checkAllInMeal = useStore((s) => s.checkAllInMeal)
  const setWater = useStore((s) => s.setWater)
  const removeExtraFood = useStore((s) => s.removeExtraFood)

  const day = nutrition[date] ?? emptyDay(date)

  const mode = useDayMode(date)
  const setMode = useDayOverrides((s) => s.set)
  const restDay = mode === 'rest'
  const targets: MacroTargets =
    restDay && MEAL_PLAN.restDayTargets ? MEAL_PLAN.restDayTargets : MEAL_PLAN.targets

  const totals = consumedTotals(MEAL_PLAN, day, restDay)
  const adherence = adherencePercent(MEAL_PLAN, day, restDay)
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
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ------------------------------ day picker ------------------------- */}
        <div>
          <DayStrip date={date} today={today} onPick={setDate} nutrition={nutrition} />
          <div className="gutter" style={{ textAlign: 'center', marginTop: 10 }}>
            <div className="t-headline">{relativeDay(date, today)}</div>
            <div className="t-caption1 dim">
              {mode === 'training' ? 'Training day' : 'Rest day'} targets
            </div>
          </div>
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
              <MacroReadout label="Protein" value={totals.protein} target={targets.protein} color={MACRO_COLORS.protein} labelColor="var(--red-text)" />
              <MacroReadout label="Carbs" value={totals.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} labelColor="var(--orange-text)" />
              <MacroReadout label="Fat" value={totals.fat} target={targets.fat} color={MACRO_COLORS.fat} labelColor="var(--yellow-text)" />
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
              onChange={(v) => setMode(date, v as DayMode)}
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
              <Stepper
                value={day.waterOz}
                onChange={(oz) => setWater(date, oz)}
                step={8}
                min={0}
                max={400}
              />
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
                day={day}
                skipped={day.skippedMeals.includes(meal.id)}
                restDay={restDay}
                onToggleItem={(id) => toggleFood(date, id)}
                onCheckAll={(v) => checkAllInMeal(date, meal.items.map((i) => i.id), v)}
                onOpen={() => push('mealDetail', { mealId: meal.id, date })}
              />
            ))}
          </div>
        </div>

        {/* -------------------------------- extras --------------------------- */}
        <div>
          <SectionHeader title="Extras" />
          <ListSection
            footer="Anything off-plan. Log it honestly — it's what tells Jud whether the plan is working."
            style={{ marginBottom: 0 }}
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
                      className="hit-expand"
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
      </div>

      <QuickAddSheet
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        date={date}
      />
    </Screen>
  )
}

/** The last fortnight as a scrollable strip, ending on today. */
function DayStrip({
  date, today, onPick, nutrition,
}: {
  date: string
  today: string
  onPick: (date: string) => void
  nutrition: Record<string, DayNutrition>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)),
    [today],
  )

  // Open on today rather than a fortnight ago.
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div ref={ref} className="hscroll" style={{ gap: 6, paddingBottom: 2 }}>
      {days.map((day) => {
        const selected = day === date
        const isToday = day === today
        const logged = Object.values(nutrition[day]?.checked ?? {}).some(Boolean)
        return (
          <button
            key={day}
            type="button"
            aria-label={formatMediumDate(day)}
            aria-current={selected ? 'date' : undefined}
            onClick={() => {
              haptic('selection')
              onPick(day)
            }}
            style={{
              flex: '0 0 auto',
              width: 44,
              padding: '7px 0 6px',
              borderRadius: 13,
              background: selected ? 'var(--accent)' : 'var(--grouped-2)',
              color: selected ? '#fff' : 'var(--label)',
              border: isToday && !selected ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span className="t-caption2 semibold" style={{ opacity: 0.65 }}>
              {weekdayMin(fromISODate(day).getDay())}
            </span>
            <span className="mono-nums" style={{ fontSize: 17, fontWeight: 600, lineHeight: '20px' }}>
              {fromISODate(day).getDate()}
            </span>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: logged
                  ? selected ? 'rgba(255,255,255,0.9)' : 'var(--accent)'
                  : 'transparent',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

function MacroReadout({
  label, value, target, color, labelColor,
}: {
  label: string
  value: number
  target: number
  color: string
  /** systemYellow reads at 1.5:1 as type — the bar keeps it, the label doesn't. */
  labelColor: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="t-footnote semibold" style={{ color: labelColor }}>{label}</span>
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
  meal, day, skipped, restDay, onToggleItem, onCheckAll, onOpen,
}: {
  meal: Meal
  day: DayNutrition
  skipped: boolean
  restDay: boolean
  onToggleItem: (id: string) => void
  onCheckAll: (value: boolean) => void
  onOpen: () => void
}) {
  const checked = day.checked
  const totals = plannedMealTotals(meal, day, MEAL_PLAN, restDay)
  const doneCount = meal.items.filter((i) => checked[i.id]).length
  const allDone = doneCount === meal.items.length

  return (
    <div className="card" style={{ margin: 0, opacity: skipped ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px 11px' }}>
        <button
          type="button"
          className="hit-expand"
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

        <button
          type="button"
          onClick={onOpen}
          className="hit-expand"
          style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
        >
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
        <button type="button" aria-label={`Open ${meal.name}`} onClick={onOpen} className="hit-expand">
          <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
        </button>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        {meal.items.map((item) => (
          <FoodLine
            key={item.id}
            item={item}
            portion={portionOf(day, item.id, MEAL_PLAN, restDay)}
            checked={!!checked[item.id]}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function FoodLine({
  item, checked, onToggle, onSwap, onPortion, portion = 1,
}: {
  item: FoodItem
  checked: boolean
  onToggle: () => void
  onSwap?: () => void
  onPortion?: () => void
  portion?: number
}) {
  const scaled = scaleFood(item, portion)
  // A real 44pt row pitch. Every control in here expands to Apple's 44×44
  // minimum, so anything shorter would have those rectangles overlapping each
  // other and the rows above and below — the classic mis-tap.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <button
        type="button"
        aria-label={checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
        className="hit-expand"
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
        <span className="dim"> · {num(scaled.qty, 1)} {unitFor(scaled.qty, item.unit)}</span>
      </span>
      {onPortion && (
        <button
          type="button"
          aria-label={`Portion for ${item.name}`}
          onClick={onPortion}
          className="mono-nums hit-expand"
          style={{
            flex: 'none',
            padding: '2px 7px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            background: portion === 1 ? 'var(--fill-4)' : 'var(--accent-soft)',
            color: portion === 1 ? 'var(--label-2)' : 'var(--accent)',
          }}
        >
          {num(portion, 2)}×
        </button>
      )}
      {onSwap &&
        (item.swaps && item.swaps.length > 0 ? (
          // A real 44×44 box rather than `hit-expand`: an expanded rectangle
          // would reach back over the portion chip's own expanded one.
          <button
            type="button"
            aria-label={`Swap ${item.name}`}
            onClick={onSwap}
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="swap" size={16} weight={2.2} color="var(--accent)" />
          </button>
        ) : (
          // Foods with no alternatives still hold the column, so the chips and
          // calories line up down the card.
          <span aria-hidden="true" style={{ flex: 'none', width: 44 }} />
        ))}
      {/* Fixed width so the kcal column — and everything left of it — lines up
          down the card instead of ragging with the digit count. */}
      <span
        className="t-caption1 dim mono-nums"
        style={{ flex: 'none', minWidth: 30, textAlign: 'right' }}
      >
        {scaled.kcal}
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
