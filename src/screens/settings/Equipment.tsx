import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Segmented } from '../../components/ios/Controls'
import { NumberPad } from '../../components/NumberPad'
import { Barbell } from '../../components/Barbell'
import { useStore } from '../../store/useStore'
import { DEFAULT_PLATES_KG, DEFAULT_PLATES_LB } from '../../domain/strength'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

export function Equipment() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const [editingBar, setEditingBar] = useState(false)

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
    <Screen title="Bar & plates" back={{ label: 'Settings', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>Bar &amp; plates</h1>
          <div className="t-subhead dim" style={{ marginTop: 3, lineHeight: '21px' }}>
            Tell GRIT what's actually on your gym floor and every prescribed load will be a weight you
            can genuinely load.
          </div>
        </div>

        <ListSection header="Bar">
          <Row
            title="Bar weight"
            value={`${num(profile.barWeight, 1)} ${profile.units}`}
            chevron
            onPress={() => setEditingBar(true)}
          />
        </ListSection>

        <div>
          <SectionHeader title="Plates you have (per side)" />
          <Card>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allPlates.map((plate) => {
                const on = profile.availablePlates.includes(plate)
                return (
                  <button
                    key={plate}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlate(plate)}
                    className="mono-nums"
                    style={{
                      padding: '9px 15px',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 15,
                      background: on ? 'var(--accent)' : 'var(--fill-4)',
                      color: on ? '#fff' : 'var(--label-2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {on && <Icon name="check" size={12} weight={3} color="#fff" />}
                    {num(plate, 2)}
                  </button>
                )
              })}
            </div>
            <div className="t-caption1 dim" style={{ marginTop: 12 }}>
              Turn off anything your gym doesn't stock — the plate calculator will route around it.
            </div>
          </Card>
        </div>

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

        <div>
          <SectionHeader title="Preview" />
          <Card>
            <div className="t-footnote dim" style={{ marginBottom: 10 }}>
              How a heavy squat would load with your setup:
            </div>
            {[0.6, 0.8, 0.95].map((pct) => {
              const target = Math.round(((profile.trainingMaxes['back-squat'] ?? 315) * pct) / profile.roundingIncrement)
                * profile.roundingIncrement
              return (
                <div key={pct} style={{ padding: '7px 0' }}>
                  <div className="t-subhead mono-nums semibold" style={{ marginBottom: 4 }}>
                    {num(target, 1)} {profile.units}
                    <span className="dim" style={{ fontWeight: 400 }}> · {Math.round(pct * 100)}% of TM</span>
                  </div>
                  <Barbell target={target} profile={profile} height={50} />
                </div>
              )
            })}
          </Card>
        </div>
      </div>

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
