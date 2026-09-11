import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, CoachNote, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { MEAL_PLAN } from '../../data/mealPlan'
import { kcalFromMacros } from '../../domain/nutrition'
import { MACRO_COLORS } from '../../components/Rings'
import { MacroSplit } from './fuel'
import { useNav } from '../../nav/nav'
import { useStore } from '../../store/useStore'
import { num } from '../../lib/format'

export function Guidelines() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const weighIns = useStore((s) => s.weighIns)
  const training = MEAL_PLAN.targets
  const rest = MEAL_PLAN.restDayTargets ?? MEAL_PLAN.targets
  // Against what the client actually weighs now, falling back to the weight
  // they started at. `Math.max(1, …)` used to stand in for a missing body-
  // weight, which printed the whole protein target as a per-pound ratio: a
  // brand-new client was told to eat 247 g of protein per pound of themselves.
  const bodyweight = weighIns[weighIns.length - 1]?.weight || profile.startWeight
  const proteinPerUnit = bodyweight > 0 ? training.protein / bodyweight : 0

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
            <MacroSplit macros={training} />
            <div className="t-caption1 dim" style={{ marginTop: 12 }}>
              {proteinPerUnit > 0 ? (
                <>
                  <span className="data">{num(proteinPerUnit, 2)} g</span> of protein per{' '}
                  {profile.units} of bodyweight — the number that protects muscle while
                  you&rsquo;re pushing the percentages.
                </>
              ) : (
                <>
                  <span className="data">{training.protein} g</span> of protein is the floor that
                  protects muscle while you&rsquo;re pushing the percentages. Step on the scale and
                  this reads back per {profile.units} of you.
                </>
              )}
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
            {/* Each target in its own colour, so the list reads as the six
                different things it is rather than as six rules of a table. The
                three macros take the hues they are drawn in everywhere else. */}
            <Row icon="flame.fill" iconColor="var(--orange)" title="Calories" value={<Amount value={training.kcal} unit="kcal" />} />
            <Row icon="bolt.fill" iconColor={MACRO_COLORS.protein} title="Protein" value={<Amount value={training.protein} unit="g" />} />
            <Row icon="fork.fill" iconColor={MACRO_COLORS.carbs} title="Carbohydrate" value={<Amount value={training.carbs} unit="g" />} />
            <Row icon="drop.fill" iconColor={MACRO_COLORS.fat} title="Fat" value={<Amount value={training.fat} unit="g" />} />
            <Row icon="heart.fill" iconColor="var(--mint)" title="Fibre" value={<Amount value={training.fiber} unit="g" />} />
            <Row icon="drop.fill" iconColor={MACRO_COLORS.water} title="Water" value={<Amount value={training.waterOz} unit="oz" />} />
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
            <Row icon="flame.fill" iconColor="var(--orange)" title="Calories" value={<Amount value={rest.kcal} unit="kcal" />} />
            <Row icon="bolt.fill" iconColor={MACRO_COLORS.protein} title="Protein" value={<Amount value={rest.protein} unit="g" />} />
            <Row icon="fork.fill" iconColor={MACRO_COLORS.carbs} title="Carbohydrate" value={<Amount value={rest.carbs} unit="g" />} />
            <Row icon="drop.fill" iconColor={MACRO_COLORS.fat} title="Fat" value={<Amount value={rest.fat} unit="g" />} />
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
                {/* The tab's own green: a rule is what this section is, not
                    something to tap. */}
                <Icon name="check" size={15} weight={2.8} color="var(--tint)" style={{ marginTop: 3 }} />
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
