import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
import '../../styles/fuel.css'
import type { DayNutrition, FoodItem, MacroTargets, Meal } from '../../domain/types'
import type { MacroTotals } from '../../domain/nutrition'
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

  const waterMet = day.waterOz >= targets.waterOz
  // The first meal still standing. A plan is executed top to bottom, so this is
  // literally the next thing to do — and on a day with nothing logged it is the
  // only instruction the screen would otherwise carry.
  const nextMealId = date === today
    ? MEAL_PLAN.meals.find(
      (m) => !day.skippedMeals.includes(m.id) && m.items.some((i) => !day.checked[i.id]),
    )?.id
    : undefined

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

        {/* -------------------------------- fuel ----------------------------- */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* 10pt arcs on a 122pt stack leave a 48pt hole, which is what a
                four-digit calorie count and its target need. At the 12pt the
                rings used to be drawn at, both strings crossed the innermost
                arc. */}
            <RingStack
              size={122}
              thickness={10}
              gap={3.5}
              rings={[
                { value: totals.protein, target: targets.protein, color: MACRO_COLORS.protein },
                { value: totals.carbs, target: targets.carbs, color: MACRO_COLORS.carbs },
                { value: totals.fat, target: targets.fat, color: MACRO_COLORS.fat },
              ]}
            >
              <div style={{ lineHeight: 1 }}>
                <div className="figure" style={{ fontSize: 20 }}>{Math.round(totals.kcal)}</div>
                <div className="data" style={{ fontSize: 10, marginTop: 4, color: 'var(--label-2)' }}>
                  of {targets.kcal}
                </div>
              </div>
            </RingStack>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
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
          </div>

          {/* What is still owed, in the two numbers the plan is actually judged
              on. The kcal pill this replaced repeated the ring's own centre. */}
          <div className="t-footnote dim" style={{ marginTop: 9 }}>
            <Remaining targets={targets} totals={totals} />
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
              <Icon
                name="drop.fill"
                size={22}
                color={waterMet ? 'var(--fuel-hit)' : MACRO_COLORS.water}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="data" style={{ fontSize: 17, lineHeight: '22px' }}>
                  {day.waterOz}
                  <span className="data-unit"> / {targets.waterOz} oz</span>
                </div>
                <div className="macro-bar" style={{ height: 6, marginTop: 6 }}>
                  <motion.div
                    className="macro-fill"
                    style={{ background: waterMet ? 'var(--fuel-hit)' : MACRO_COLORS.water }}
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
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MEAL_PLAN.meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                day={day}
                skipped={day.skippedMeals.includes(meal.id)}
                restDay={restDay}
                isNext={meal.id === nextMealId}
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
                  subtitle={<MacroLine food={food} />}
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
        const logged = Object.values(nutrition[day]?.checked ?? {}).some(Boolean)
        return (
          <button
            key={day}
            type="button"
            className="day-cell"
            aria-label={formatMediumDate(day)}
            aria-current={selected ? 'date' : undefined}
            data-today={day === today ? 'true' : undefined}
            data-logged={logged ? 'true' : undefined}
            onClick={() => {
              haptic('selection')
              onPick(day)
            }}
          >
            <span className="eyebrow day-cell-wd" style={{ color: 'inherit' }}>
              {weekdayMin(fromISODate(day).getDay())}
            </span>
            <span className="data day-cell-num">{fromISODate(day).getDate()}</span>
            <span className="day-cell-dot" />
          </button>
        )
      })}
    </div>
  )
}

/**
 * One macro beside the rings. The name is an eyebrow, the figure and its target
 * are one object, and the bar carries the macro's own tone — which turns to the
 * hit colour the moment the target lands, so "protein is done" is legible
 * without reading a digit.
 */
function MacroReadout({
  label, value, target, color,
}: {
  label: string
  value: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const met = target > 0 && value >= target
  return (
    <div
      className="macro-row"
      data-met={met ? 'true' : undefined}
      // Resolved here rather than in a rule keyed off data-met: an inline
      // custom property outranks any stylesheet, so the met colour had to win
      // in the same place the macro's own tone is set.
      style={{ '--macro': met ? 'var(--fuel-hit)' : color } as CSSProperties}
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
 * What the day still owes, in the two numbers the plan is judged on.
 *
 * The slack is not politeness: the plan's own meals sum to 2921 kcal against a
 * 2920 kcal target, so a client who followed it exactly was being told they had
 * gone over.
 */
const KCAL_SLACK = 5

function Remaining({ targets, totals }: { targets: MacroTargets; totals: MacroTotals }) {
  const kcalLeft = Math.round(targets.kcal - totals.kcal)
  const proteinLeft = Math.round(targets.protein - totals.protein)
  if (kcalLeft < -KCAL_SLACK) {
    return <>
      <span className="data">{-kcalLeft}</span> kcal over the day&rsquo;s target.
    </>
  }
  if (proteinLeft > 0) {
    return <>
      <span className="data">{kcalLeft}</span> kcal and <span className="data">{proteinLeft} g</span>
      {' '}of protein still to go.
    </>
  }
  if (kcalLeft <= KCAL_SLACK) return <>Protein and calories both landed. The day is on plan.</>
  return <>
    Protein is in. <span className="data">{kcalLeft}</span> kcal left today.
  </>
}

/** A food's calories and macros, set as data with the letters as units. */
export function MacroLine({
  food,
}: {
  food: { kcal: number; protein: number; carbs: number; fat: number }
}) {
  return (
    <span className="data" style={{ fontSize: 'inherit' }}>
      {Math.round(food.kcal)}<span className="data-unit"> kcal</span>
      <span className="data-unit"> · P</span>{Math.round(food.protein)}
      <span className="data-unit"> C</span>{Math.round(food.carbs)}
      <span className="data-unit"> F</span>{Math.round(food.fat)}
    </span>
  )
}

function MealCard({
  meal, day, skipped, restDay, isNext, onToggleItem, onCheckAll, onOpen,
}: {
  meal: Meal
  day: DayNutrition
  skipped: boolean
  restDay: boolean
  isNext: boolean
  onToggleItem: (id: string) => void
  onCheckAll: (value: boolean) => void
  onOpen: () => void
}) {
  const checked = day.checked
  const totals = plannedMealTotals(meal, day, MEAL_PLAN, restDay)
  const doneCount = meal.items.filter((i) => checked[i.id]).length
  const allDone = doneCount === meal.items.length
  // Six meals of four foods is twenty-four rows, and a plan a client is working
  // through should get shorter as they work through it. A meal that is finished
  // or deliberately skipped folds down to the line that summarises it; its rows
  // are still one tap away, and unticking the meal brings them straight back.
  const state = skipped ? 'skipped' : allDone ? 'done' : 'open'

  return (
    <div className="card meal-card" data-state={state}>
      <div className="meal-head">
        <button
          type="button"
          className="hit-expand meal-check"
          aria-label={allDone ? `Uncheck ${meal.name}` : `Check off ${meal.name}`}
          onClick={() => {
            haptic(allDone ? 'light' : 'success')
            onCheckAll(!allDone)
          }}
        >
          {allDone && <Icon name="check" size={15} weight={3} color="#fff" />}
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="hit-expand"
          style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
        >
          {/* Above the name rather than beside it: an eyebrow is a label on
              what follows, and inline it took the width a 320pt screen needs
              for the meal's own name. */}
          {isNext && <div className="eyebrow meal-next">Next</div>}
          <div className="meal-name">
            <span className="t-headline truncate">{meal.name}</span>
            <span className="t-caption1 dim" style={{ flex: 'none' }}>{formatClock(meal.time)}</span>
          </div>
          <div className="t-footnote dim">
            {skipped ? 'Skipped today' : <MacroLine food={totals} />}
          </div>
        </button>

        <span className="data meal-count">{doneCount}/{meal.items.length}</span>
        <button type="button" aria-label={`Open ${meal.name}`} onClick={onOpen} className="hit-expand">
          <Icon name="chevron.right" size={15} weight={2.6} color="var(--label-3)" />
        </button>
      </div>

      {state === 'open' && (
        <div className="meal-foods">
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
      )}
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
  return (
    <div className="food-line" data-checked={checked ? 'true' : undefined}>
      <button
        type="button"
        aria-label={checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
        className="hit-expand food-check"
        onClick={() => {
          haptic('selection')
          onToggle()
        }}
      >
        {checked && <Icon name="check" size={12} weight={3.2} color="#fff" />}
      </button>
      <span className="t-subhead truncate food-name">
        {item.name}
        <span className="data food-qty" style={{ fontSize: 13, fontWeight: 500 }}>
          {' · '}{num(scaled.qty, 1)} {unitFor(scaled.qty, item.unit)}
        </span>
      </span>
      {onPortion && (
        <button
          type="button"
          aria-label={`Portion for ${item.name}`}
          onClick={onPortion}
          className="data hit-expand food-portion"
          data-adjusted={portion === 1 ? undefined : 'true'}
        >
          {num(portion, 2)}×
        </button>
      )}
      {onSwap &&
        (item.swaps && item.swaps.length > 0 ? (
          // A real 44x44 box rather than `hit-expand`: an expanded rectangle
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
      <span className="data food-kcal">{scaled.kcal}</span>
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
              <span className="row-sub">
                <MacroLine food={food} />
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
