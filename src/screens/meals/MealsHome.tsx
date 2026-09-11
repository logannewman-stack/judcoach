import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Segmented, Stepper } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { SwipeRow, useSwipeGroup } from '../../components/ios/SwipeRow'
import { MACRO_COLORS } from '../../components/Rings'
import { toast } from '../../components/ios/Toast'
import { useStore, emptyDay } from '../../store/useStore'
import { MEAL_PLAN, QUICK_ADDS } from '../../data/mealPlan'
import '../../styles/fuel.css'
import type { DayNutrition, FoodItem, MacroTargets, Meal } from '../../domain/types'
import type { MacroTotals } from '../../domain/nutrition'
import {
  adherencePercent, consumedTotals, foodTotals, plannedMealTotals, portionOf, proteinStatus, scaleFood,
} from '../../domain/nutrition'
import { FuelReadout, kcalStanding } from './fuel'
import {
  addDays, formatClock, formatMediumDate, fromISODate, relativeDay, todayISO, weekdayMin,
} from '../../lib/date'
import { num, unitFor } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'
import { useDayMode, useSetDayMode } from './dayMode'
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
  const setMode = useSetDayMode()
  const restDay = mode === 'rest'
  const targets: MacroTargets =
    restDay && MEAL_PLAN.restDayTargets ? MEAL_PLAN.restDayTargets : MEAL_PLAN.targets

  const totals = consumedTotals(MEAL_PLAN, day, restDay)
  const adherence = adherencePercent(MEAL_PLAN, day, restDay)
  const protein = proteinStatus(targets, totals)
  const kcal = kcalStanding(targets, totals)
  const [quickAdd, setQuickAdd] = useState(false)
  const swipe = useSwipeGroup()

  const waterMet = day.waterOz >= targets.waterOz
  // Nothing eaten is a different state from something eaten badly, and a day
  // already behind you is a third: it cannot be "still to go".
  const started = totals.kcal > 0
  const past = date < today
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
          {/* The same component Today renders, so the two cards cannot reach
              two verdicts on one day's three numbers. */}
          <FuelReadout targets={targets} totals={totals} />

          <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
            {/* "Protein short" in red is a verdict, and at seven in the morning
                on a day nobody has eaten yet it is a verdict on nothing. A plan
                that has not been started is not a plan that has been failed. */}
            {!started ? (
              <Pill>{past ? 'Nothing logged' : 'Not started yet'}</Pill>
            ) : (
              <>
                <Pill tone={protein.status}>{protein.label}</Pill>
                {adherence >= 100 ? (
                  <Pill tone="good" icon="seal.fill">Plan complete</Pill>
                ) : (
                  <Pill tone={adherence >= 80 ? 'good' : adherence >= 50 ? 'warn' : 'default'}>
                    {adherence}% of plan
                  </Pill>
                )}
                {/* Ticking the whole plan and then eating a day's worth on
                    top of it is still a completed plan, so the overshoot gets
                    its own pill rather than taking one away. Without it this
                    row was two greens and a seal on a day 1200 kcal over, and
                    the pills are what the card is read at a glance. The figure
                    itself is in the line underneath; the pill is the verdict. */}
                {kcal.state === 'over' && <Pill tone="warn">Over target</Pill>}
              </>
            )}
          </div>

          {/* What is still owed, in the two numbers the plan is actually judged
              on. The kcal pill this replaced repeated the ring's own centre. */}
          <div className="t-footnote fuel-note" data-tone={kcal.state} style={{ marginTop: 9 }}>
            <Remaining
              targets={targets}
              totals={totals}
              started={started}
              past={past}
              complete={adherence >= 100}
              opening={MEAL_PLAN.meals[0]}
            />
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
                <div className="data water-figure">
                  {day.waterOz}
                  <span className="data-unit"> / {targets.waterOz} oz</span>
                  {/* A filled bar reports the target the way a closed ring
                      does, and the tick is the affirmation that goes with it.
                      The bar keeps the water's own blue either way: it used to
                      flip to the hit green, which is protein's colour. */}
                  {waterMet && (
                    <Icon name="check.circle.fill" size={15} color="var(--fuel-hit)" />
                  )}
                </div>
                <div className="macro-bar" style={{ marginTop: 6 }}>
                  <motion.div
                    className="macro-fill"
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
            // The strip goes back a fortnight, and a Tuesday three days ago was
            // still being headed "Today's meals".
            title={date === today ? "Today's meals" : "That day's meals"}
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
 * What the day still owes, in the two numbers the plan is judged on.
 *
 * The tense is the day's, not the reader's: a Tuesday nine days ago cannot have
 * anything "still to go" in it and nothing is "left today", so every branch
 * here reads `past`. It used to be consulted only on a day with nothing logged,
 * which left a fortnight of history telling the client to go and eat.
 */
function Remaining({
  targets, totals, started, past, complete, opening,
}: {
  targets: MacroTargets
  totals: MacroTotals
  /** False until something has actually been eaten. */
  started: boolean
  /** A day already behind the client, where nothing is "still to go". */
  past: boolean
  /** Every planned item ticked. */
  complete: boolean
  /** The first meal of the plan, for a day that has not begun. */
  opening?: Meal
}) {
  const { left: kcalLeft, state } = kcalStanding(targets, totals)
  const proteinLeft = Math.round(targets.protein - totals.protein)
  // A plan waiting to be executed, stated as the plan rather than as a debt.
  // "2920 kcal still to go" before breakfast reads as arrears on a day the
  // client has done nothing wrong in.
  if (!started) {
    if (past) {
      return <>Nothing logged for this day. Tick off what you remember — a half-recorded day still tells Jud more than a blank one.</>
    }
    return <>
      <span className="data">{MEAL_PLAN.meals.length}</span> meals,{' '}
      <span className="data">{targets.kcal}</span> kcal,{' '}
      <span className="data">{targets.protein} g</span> of protein.
      {opening && <> {opening.name} at {formatClock(opening.time)} starts it.</>}
    </>
  }
  if (state === 'over') {
    return <>
      <span className="data">{-kcalLeft}</span> kcal over {past ? 'that' : 'the'} day&rsquo;s target.
    </>
  }
  if (proteinLeft > 0) {
    // Calories can land while protein has not — a day carried on carbohydrate.
    // Naming the calorie figure here printed a negative one: three kcal past
    // the target is inside the slack and is not "−3 kcal still to go".
    if (state === 'met') {
      return past
        ? <>
          Calories landed, but that day finished <span className="data">{proteinLeft} g</span>
          {' '}of protein short.
        </>
        : <>
          Calories are in. <span className="data">{proteinLeft} g</span> of protein still to go.
        </>
    }
    return past
      ? <>
        That day finished <span className="data">{kcalLeft}</span> kcal and{' '}
        <span className="data">{proteinLeft} g</span> of protein short.
      </>
      : <>
        <span className="data">{kcalLeft}</span> kcal and <span className="data">{proteinLeft} g</span>
        {' '}of protein still to go.
      </>
  }
  if (state === 'met') {
    return complete
      ? <>Every item ticked, protein and calories both landed. That is the day exactly as written.</>
      : <>Protein and calories both landed. The day {past ? 'came in' : 'is'} on plan.</>
  }
  return past
    ? <>
      Protein is in. That day came in <span className="data">{kcalLeft}</span> kcal under target.
    </>
    : <>
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
            style={{ borderRadius: 'var(--r-chip)' }}
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
