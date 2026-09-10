import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, CoachNote, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { MEAL_PLAN } from '../../data/mealPlan'
import { kcalFromMacros, macroSplitPercent } from '../../domain/nutrition'
import { MACRO_COLORS } from '../../components/Rings'
import { useNav } from '../../nav/nav'
import { useStore } from '../../store/useStore'
import { num } from '../../lib/format'

export function Guidelines() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const training = MEAL_PLAN.targets
  const rest = MEAL_PLAN.restDayTargets ?? MEAL_PLAN.targets
  const split = macroSplitPercent(training)
  const proteinPerLb = training.protein / Math.max(1, profile.startWeight)

  return (
    <Screen title="Plan guidelines" back={{ label: 'Meals', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>{MEAL_PLAN.name}</h1>
          <div className="t-subhead dim" style={{ marginTop: 2 }}>{MEAL_PLAN.subtitle}</div>
        </div>

        <div className="gutter">
          <CoachNote>
            Percentages set the floor, protein sets the ceiling. If a day goes sideways, protect the
            protein number and let the carbs take the hit.
          </CoachNote>
        </div>

        {/* --------------------------- macro split --------------------------- */}
        <div>
          <SectionHeader title="Where the calories come from" />
          <Card>
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${split.protein}%`, background: MACRO_COLORS.protein }} />
              <div style={{ width: `${split.carbs}%`, background: MACRO_COLORS.carbs }} />
              <div style={{ width: `${split.fat}%`, background: MACRO_COLORS.fat }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
              <SplitLegend label="Protein" pct={split.protein} grams={training.protein} color={MACRO_COLORS.protein} />
              <SplitLegend label="Carbs" pct={split.carbs} grams={training.carbs} color={MACRO_COLORS.carbs} />
              <SplitLegend label="Fat" pct={split.fat} grams={training.fat} color={MACRO_COLORS.fat} />
            </div>
            <div className="t-caption1 dim" style={{ marginTop: 12 }}>
              {num(proteinPerLb, 2)} g of protein per lb of bodyweight — the number that protects muscle
              while you're pushing the percentages.
            </div>
          </Card>
        </div>

        {/* ------------------------------ targets ---------------------------- */}
        <ListSection header="Training day" footer={`Macros total ${kcalFromMacros(training)} kcal.`}>
          <Row title="Calories" value={`${training.kcal} kcal`} />
          <Row title="Protein" value={`${training.protein} g`} />
          <Row title="Carbohydrate" value={`${training.carbs} g`} />
          <Row title="Fat" value={`${training.fat} g`} />
          <Row title="Fibre" value={`${training.fiber} g`} />
          <Row title="Water" value={`${training.waterOz} oz`} />
        </ListSection>

        <ListSection
          header="Rest day"
          footer={`${training.carbs - rest.carbs} g fewer carbs. Protein and fat are unchanged.`}
        >
          <Row title="Calories" value={`${rest.kcal} kcal`} />
          <Row title="Protein" value={`${rest.protein} g`} />
          <Row title="Carbohydrate" value={`${rest.carbs} g`} />
          <Row title="Fat" value={`${rest.fat} g`} />
        </ListSection>

        {/* ------------------------------- rules ----------------------------- */}
        <div>
          <SectionHeader title="The rules" />
          <Card>
            {MEAL_PLAN.guidelines.map((rule, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '7px 0',
                  alignItems: 'flex-start',
                }}
              >
                <Icon name="check" size={15} weight={2.8} color="var(--accent)" style={{ marginTop: 3 }} />
                <span className="t-subhead" style={{ lineHeight: '20px' }}>{rule}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Screen>
  )
}

function SplitLegend({
  label, pct, grams, color,
}: {
  label: string
  pct: number
  grams: number
  color: string
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: 'none' }} />
        <span className="t-caption1 dim semibold truncate">{label}</span>
      </div>
      <div className="t-headline mono-nums">{pct}%</div>
      <div className="t-caption1 dim mono-nums">{grams} g</div>
    </div>
  )
}
