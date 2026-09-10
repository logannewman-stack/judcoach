import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Segmented } from '../../components/ios/Controls'
import { Icon } from '../../components/Icon'
import { MEAL_PLAN } from '../../data/mealPlan'
import { groceryList } from '../../domain/nutrition'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

export function Grocery() {
  const pop = useNav((s) => s.pop)
  const [days, setDays] = useState('7')
  const [ticked, setTicked] = useState<Record<string, boolean>>({})

  const lines = useMemo(() => groceryList(MEAL_PLAN, Number(days)), [days])
  const remaining = lines.filter((l) => !ticked[l.name]).length

  return (
    <Screen
      title="Grocery list"
      back={{ label: 'Meals', onPress: pop }}
      largeTitle={false}
      right={{
        label: 'Reset',
        onPress: () => setTicked({}),
        disabled: remaining === lines.length,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>Grocery list</h1>
          <div className="t-subhead dim" style={{ marginTop: 2 }}>
            Everything the plan needs · {remaining} of {lines.length} left
          </div>
        </div>

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

        <ListSection
          header="Shop"
          footer="Quantities assume you follow the plan exactly. Round up on the fresh stuff."
        >
          {lines.map((line) => {
            const done = !!ticked[line.name]
            return (
              <Row
                key={line.name}
                title={
                  <span
                    style={{
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--label-3)' : undefined,
                    }}
                  >
                    {line.name}
                  </span>
                }
                subtitle={line.uses > 1 ? `Used in ${line.uses} meals` : undefined}
                value={
                  <span style={{ color: done ? 'var(--label-3)' : undefined }}>
                    {num(line.qty, 0)} {line.unit}
                  </span>
                }
                inset
                leading={
                  <span
                    style={{
                      width: 24, height: 24, borderRadius: '50%', flex: 'none',
                      display: 'grid', placeItems: 'center',
                      background: done ? 'var(--green)' : 'transparent',
                      border: done ? 'none' : '1.8px solid var(--label-3)',
                    }}
                  >
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
