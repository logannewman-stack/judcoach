import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { Segmented } from '../../components/ios/Controls'
import { NumberPad } from '../../components/NumberPad'
import { Barbell } from '../../components/Barbell'
import { useStore } from '../../store/useStore'
import { DEFAULT_PLATES_KG, DEFAULT_PLATES_LB, roundToIncrement } from '../../domain/strength'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

export function Equipment() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const [editingBar, setEditingBar] = useState(false)
  const squatMax = profile.trainingMaxes['back-squat'] ?? 0

  const allPlates = profile.units === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB
  const increments = profile.units === 'kg' ? [1, 2.5, 5] : [2.5, 5, 10]

  const togglePlate = (plate: number) => {
    haptic('selection')
    const has = profile.availablePlates.includes(plate)
    updateProfile({
      availablePlates: has
        ? profile.availablePlates.filter((p) => p !== plate)
        : [...profile.availablePlates, plate].sort((a, b) => b - a),
    })
  }

  return (
    <Screen
      title="Bar & plates"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter t-subhead dim" style={{ margin: '-2px 0 24px', lineHeight: '21px' }}>
          Tell GRIT what's actually on your gym floor and every prescribed load will be a weight you
          can genuinely load.
        </div>
      }
    >
      <ListSection header="Bar">
        <Row
          title="Bar weight"
          value={`${num(profile.barWeight, 1)} ${profile.units}`}
          chevron
          onPress={() => setEditingBar(true)}
        />
      </ListSection>

      <ListSection
        header="Plates you have (per side)"
        footer="Turn off anything your gym doesn't stock — the plate calculator will route around it."
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '13px var(--gutter)' }}>
          {allPlates.map((plate) => {
            const on = profile.availablePlates.includes(plate)
            return (
              <button
                key={plate}
                type="button"
                aria-pressed={on}
                onClick={() => togglePlate(plate)}
                className="data"
                style={{
                  padding: '11px 15px',
                  borderRadius: 'var(--r-chip)',
                  fontWeight: 700,
                  fontSize: 15,
                  // Tinted rather than filled: a rack is six or seven chips and
                  // nearly all of them are on, which made most of this screen a
                  // field of accent. The accent marks what to tap, not what is.
                  background: on ? 'var(--accent-soft)' : 'var(--fill-4)',
                  color: on ? 'var(--accent)' : 'var(--label-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {on && <Icon name="check" size={12} weight={3} color="var(--accent)" />}
                {num(plate, 2)}
              </button>
            )
          })}
        </div>
      </ListSection>

      <ListSection
        header="Rounding"
        footer="Percentage-based loads rarely land on a real number. GRIT rounds to the smallest jump you can actually make."
      >
        <div style={{ padding: '10px var(--gutter)' }}>
          <Segmented
            options={increments.map((i) => ({ value: String(i), label: `${num(i, 2)} ${profile.units}` }))}
            value={String(profile.roundingIncrement)}
            onChange={(v) => updateProfile({ roundingIncrement: Number(v) })}
          />
        </div>
      </ListSection>

      {/* Off the client's own squat max, or not at all. The fallback here was a
          literal 315 — a max nobody had entered, drawn as three loaded bars
          under a footer that called it "your current working max", and in
          pounds whatever the client counted in, so a kilo lifter was shown a
          315 kg squat. A zeroed max slipped past `?? 315` and drew three empty
          bars instead. There is no honest preview without a real number, so
          this asks for one. */}
      <ListSection
        header="Preview"
        footer={
          squatMax > 0
            ? 'Three squat loads off your current working max, built from the bar and plates above.'
            : 'Every prescribed load is a share of a working max, and the preview needs one to be a share of.'
        }
      >
        {squatMax > 0 ? (
          <div style={{ padding: '10px var(--gutter) 13px' }}>
            {[0.6, 0.8, 0.95].map((pct) => {
              const target = roundToIncrement(squatMax * pct, profile.roundingIncrement)
              return (
                <div key={pct} style={{ padding: '7px 0' }}>
                  <div className="data" style={{ fontSize: 15, marginBottom: 4 }}>
                    {num(target, 1)}
                    <span className="figure-unit"> {profile.units}</span>
                    <span className="dim" style={{ fontWeight: 400 }}> · {Math.round(pct * 100)}% of max</span>
                  </div>
                  <Barbell target={target} profile={profile} height={50} />
                </div>
              )
            })}
          </div>
        ) : (
          <Row
            title="No squat max on file"
            subtitle="Set one and real loads appear here"
            icon="chart.bar"
            iconColor="var(--blue)"
            chevron
            onPress={() => push('trainingMaxes')}
          />
        )}
      </ListSection>

      <NumberPad
        open={editingBar}
        onClose={() => setEditingBar(false)}
        onSubmit={(v) => updateProfile({ barWeight: v })}
        title="Bar weight"
        initial={profile.barWeight}
        unit={profile.units}
        steps={profile.units === 'kg' ? [-5, -2.5, 2.5, 5] : [-10, -5, 5, 10]}
        hint={profile.units === 'kg' ? 'An Olympic bar is 20 kg.' : 'An Olympic bar is 45 lb.'}
      />
    </Screen>
  )
}
