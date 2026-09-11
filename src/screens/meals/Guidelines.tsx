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
    <Screen
      title={MEAL_PLAN.name}
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">{MEAL_PLAN.subtitle}</div>
        </div>
      }
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. Headers are all
          SectionHeader; iOS never mixes header styles inside one screen. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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
            <div style={{ display: 'flex', height: 12, borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
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
              <span className="data">{num(proteinPerLb, 2)} g</span> of protein per lb of bodyweight
              — the number that protects muscle while you&rsquo;re pushing the percentages.
            </div>
          </Card>
        </div>

        {/* ------------------------------ targets ---------------------------- */}
        <div>
          <SectionHeader title="Training day" />
          <ListSection
            footer={<>Macros total <span className="data">{kcalFromMacros(training)} kcal</span>.</>}
            style={{ marginBottom: 0 }}
          >
            <Row title="Calories" value={<Amount value={training.kcal} unit="kcal" />} />
            <Row title="Protein" value={<Amount value={training.protein} unit="g" />} />
            <Row title="Carbohydrate" value={<Amount value={training.carbs} unit="g" />} />
            <Row title="Fat" value={<Amount value={training.fat} unit="g" />} />
            <Row title="Fibre" value={<Amount value={training.fiber} unit="g" />} />
            <Row title="Water" value={<Amount value={training.waterOz} unit="oz" />} />
          </ListSection>
        </div>

        <div>
          <SectionHeader title="Rest day" />
          <ListSection
            footer={
              <>
                <span className="data">{training.carbs - rest.carbs} g</span> fewer carbs. Protein
                and fat are unchanged.
              </>
            }
            style={{ marginBottom: 0 }}
          >
            <Row title="Calories" value={<Amount value={rest.kcal} unit="kcal" />} />
            <Row title="Protein" value={<Amount value={rest.protein} unit="g" />} />
            <Row title="Carbohydrate" value={<Amount value={rest.carbs} unit="g" />} />
            <Row title="Fat" value={<Amount value={rest.fat} unit="g" />} />
          </ListSection>
        </div>

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

/** A target's value and its unit: one object, both in the data face. */
function Amount({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="data">
      {value}
      <span className="data-unit"> {unit}</span>
    </span>
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
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }} />
        <span className="eyebrow truncate">{label}</span>
      </div>
      <div className="data" style={{ fontSize: 17, lineHeight: '22px', fontWeight: 700 }}>{pct}%</div>
      <div className="data" style={{ fontSize: 12, lineHeight: '16px', color: 'var(--label-2)' }}>
        {grams} g
      </div>
    </div>
  )
}
