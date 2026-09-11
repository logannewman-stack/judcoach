import { useEffect, useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row, rowSepInset } from '../../components/ios/List'
import { Card } from '../../components/Bits'
import { Segmented } from '../../components/ios/Controls'
import { Icon } from '../../components/Icon'
import { MEAL_PLAN } from '../../data/mealPlan'
import { foodTotals, groceryList } from '../../domain/nutrition'
import { MacroSplit } from './fuel'
import { compact, num, unitFor } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

/* ============================================================================
   Ticks are a shopping-trip scratchpad rather than training data, so they live
   in sessionStorage instead of the store: they survive leaving the screen and
   an accidental reload mid-aisle, and are gone by the next shop.
   ========================================================================== */

const TICKS_KEY = 'grit-grocery-ticks'

function readTicks(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(TICKS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function Grocery() {
  const pop = useNav((s) => s.pop)
  const [days, setDays] = useState('7')
  const [ticked, setTicked] = useState<Record<string, boolean>>(readTicks)

  useEffect(() => {
    try {
      sessionStorage.setItem(TICKS_KEY, JSON.stringify(ticked))
    } catch {
      // Private browsing with no quota — the list still works for this visit.
    }
  }, [ticked])

  const reset = () => setTicked({})

  const lines = useMemo(() => groceryList(MEAL_PLAN, Number(days)), [days])
  const remaining = lines.filter((l) => !ticked[l.name]).length
  // What is in the trolley, from the plan's own foods rather than from the
  // day's targets: the list is built by multiplying those items up, and the two
  // differ by the gram or so the plan rounds off.
  const shop = useMemo(() => {
    const perDay = foodTotals(MEAL_PLAN.meals.flatMap((m) => m.items))
    const n = Number(days)
    return {
      kcal: perDay.kcal * n,
      protein: perDay.protein * n,
      carbs: perDay.carbs * n,
      fat: perDay.fat * n,
    }
  }, [days])

  return (
    <Screen
      title="Grocery list"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">
            {/* "0 of 42 left" is a true sentence and a poor way to say the shop
                is done. */}
            {remaining === 0 ? (
              <>Everything the plan needs · all <span className="data">{lines.length}</span> ticked off</>
            ) : (
              <>Everything the plan needs · <span className="data">{remaining} of {lines.length}</span> left</>
            )}
          </div>
        </div>
      }
      right={{
        label: 'Reset',
        onPress: reset,
        disabled: remaining === lines.length,
      }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="gutter">
          <Segmented
            options={[
              { value: '3', label: '3 days' },
              { value: '7', label: '1 week' },
              { value: '14', label: '2 weeks' },
            ]}
            value={days}
            onChange={setDays}
          />
        </div>

        {/* What the trolley adds up to, in the hues the macros are drawn in on
            every other Meals screen. A shopping list is the plan stated as
            quantities, and it was the one screen in the tab that never said
            what the quantities were for. */}
        <Card>
          <div className="meal-total">
            <span className="figure">{compact(shop.kcal)}</span>
            <span className="figure-unit"> kcal</span>
            <span className="t-footnote dim">
              <span className="data">{lines.length}</span> items ·{' '}
              <span className="data">{days}</span> days
            </span>
          </div>
          <MacroSplit macros={shop} />
        </Card>

        <ListSection
          header="Shop"
          footer="Ticks stay put while the app is open — quantities assume you follow the plan exactly, so round up on the fresh stuff."
          style={{ marginBottom: 0 }}
        >
          {lines.map((line) => {
            const done = !!ticked[line.name]
            return (
              <Row
                key={line.name}
                title={
                  /* Struck through, not faded out of legibility: --label-3 on a
                     card measures near 2:1, which is not a state, it is a
                     redaction. */
                  <span
                    style={{
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--label-2)' : undefined,
                    }}
                  >
                    {line.name}
                  </span>
                }
                subtitle={
                  line.uses > 1
                    ? <>Used in <span className="data">{line.uses}</span> meals</>
                    : undefined
                }
                value={
                  <span className="data" style={{ color: done ? 'var(--label-2)' : undefined }}>
                    {num(line.qty, 0)}
                    <span className="data-unit"> {unitFor(line.qty, line.unit)}</span>
                  </span>
                }
                /* The hairline starts where the text does. `inset` alone falls
                   back to the 29px an icon tile is wide, which put the rule
                   five pixels inside every item's name. */
                sepInset={rowSepInset(24)}
                leading={
                  <span className="grocery-tick" data-done={done ? 'true' : undefined}>
                    {done && <Icon name="check" size={13} weight={3.2} color="#fff" />}
                  </span>
                }
                onPress={() => {
                  haptic('selection')
                  setTicked((t) => ({ ...t, [line.name]: !t[line.name] }))
                }}
              />
            )
          })}
        </ListSection>
      </div>
    </Screen>
  )
}
