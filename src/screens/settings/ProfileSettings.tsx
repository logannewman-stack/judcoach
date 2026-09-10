import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Segmented } from '../../components/ios/Controls'
import { NumberPad } from '../../components/NumberPad'
import { Sheet } from '../../components/ios/Sheet'
import { useStore } from '../../store/useStore'
import { kgToLb, lbToKg, DEFAULT_PLATES_KG, DEFAULT_PLATES_LB } from '../../domain/strength'
import type { Units } from '../../domain/types'
import { fixed, num } from '../../lib/format'
import { useNav } from '../../nav/nav'
import { toast } from '../../components/ios/Toast'

type Field = 'startWeight' | 'goalWeight' | 'weeklyRateTarget' | 'heightIn' | 'birthYear' | null

export function ProfileSettings() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const [field, setField] = useState<Field>(null)
  const [naming, setNaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile.name)

  /** Switching units converts every stored number so nothing silently changes meaning. */
  const changeUnits = (next: Units) => {
    if (next === profile.units) return
    const convert = next === 'kg' ? lbToKg : kgToLb
    const round = (v: number) => Math.round(v * 10) / 10
    updateProfile({
      units: next,
      startWeight: round(convert(profile.startWeight)),
      goalWeight: round(convert(profile.goalWeight)),
      weeklyRateTarget: round(convert(profile.weeklyRateTarget)),
      barWeight: next === 'kg' ? 20 : 45,
      availablePlates: next === 'kg' ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB,
      roundingIncrement: next === 'kg' ? 2.5 : 5,
      trainingMaxes: Object.fromEntries(
        Object.entries(profile.trainingMaxes).map(([k, v]) => [k, round(convert(v))]),
      ),
    })
    toast(`Switched to ${next}`, { icon: 'swap' })
  }

  const heightText = `${Math.floor(profile.heightIn / 12)}′ ${Math.round(profile.heightIn % 12)}″`
  const age = new Date().getFullYear() - profile.birthYear

  return (
    <Screen title="Profile" back={{ label: 'Settings', onPress: pop }}>
      <ListSection header="You">
        <Row title="Name" value={profile.name} chevron onPress={() => setNaming(true)} />
        <Row title="Height" value={heightText} chevron onPress={() => setField('heightIn')} />
        <Row title="Age" value={`${age}`} chevron onPress={() => setField('birthYear')} />
        <Row
          title="Sex"
          trailing={
            <div role="group" aria-label="Sex" style={{ flex: 'none' }}>
              <Segmented
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                value={profile.sex}
                onChange={(v) => updateProfile({ sex: v })}
                style={{ width: 152 }}
              />
            </div>
          }
        />
      </ListSection>

      <ListSection header="Units" footer="Changing units converts every weight in the app, including your working maxes and plate inventory.">
        <div style={{ padding: '10px var(--gutter)' }}>
          <Segmented
            options={[
              { value: 'lb', label: 'Pounds' },
              { value: 'kg', label: 'Kilograms' },
            ]}
            value={profile.units}
            onChange={(v) => changeUnits(v as Units)}
          />
        </div>
      </ListSection>

      <ListSection
        header="Bodyweight goal"
        footer="Jud compares your 7-day average against this rate every week. It is the number that decides whether calories move."
      >
        <Row
          title="Starting weight"
          value={`${fixed(profile.startWeight, 1)} ${profile.units}`}
          chevron
          onPress={() => setField('startWeight')}
        />
        <Row
          title="Goal weight"
          value={`${fixed(profile.goalWeight, 1)} ${profile.units}`}
          chevron
          onPress={() => setField('goalWeight')}
        />
        <Row
          title="Target rate"
          value={`${profile.weeklyRateTarget > 0 ? '+' : ''}${num(profile.weeklyRateTarget, 2)} ${profile.units}/wk`}
          chevron
          onPress={() => setField('weeklyRateTarget')}
        />
        <Row title="Goal label" value={profile.goalLabel} />
      </ListSection>

      <NumberPad
        open={field === 'startWeight'}
        onClose={() => setField(null)}
        onSubmit={(v) => updateProfile({ startWeight: v })}
        title="Starting weight"
        initial={profile.startWeight}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
      <NumberPad
        open={field === 'goalWeight'}
        onClose={() => setField(null)}
        onSubmit={(v) => updateProfile({ goalWeight: v })}
        title="Goal weight"
        initial={profile.goalWeight}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
      <NumberPad
        open={field === 'weeklyRateTarget'}
        onClose={() => setField(null)}
        onSubmit={(v) => updateProfile({ weeklyRateTarget: v })}
        title="Weekly rate"
        initial={Math.abs(profile.weeklyRateTarget)}
        unit={`${profile.units}/wk`}
        steps={[-0.5, -0.1, 0.1, 0.5]}
        hint="Enter the size of the change; the direction comes from your goal weight."
      />
      <NumberPad
        open={field === 'heightIn'}
        onClose={() => setField(null)}
        onSubmit={(v) => updateProfile({ heightIn: Math.round(v) })}
        title="Height"
        initial={profile.heightIn}
        unit="inches"
        allowDecimal={false}
        steps={[-1, 1]}
        max={100}
      />
      <NumberPad
        open={field === 'birthYear'}
        onClose={() => setField(null)}
        onSubmit={(v) => updateProfile({ birthYear: Math.round(v) })}
        title="Birth year"
        initial={profile.birthYear}
        allowDecimal={false}
        max={new Date().getFullYear()}
      />

      <Sheet
        open={naming}
        onClose={() => setNaming(false)}
        title="Name"
        left={{ label: 'Cancel', onPress: () => setNaming(false) }}
        right={{
          label: 'Save',
          strong: true,
          onPress: () => {
            if (nameDraft.trim()) updateProfile({ name: nameDraft.trim() })
            setNaming(false)
          },
        }}
        detent={0.4}
      >
        <div style={{ padding: '8px 16px 16px' }}>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your name"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: 'none', background: 'var(--fill-3)',
            }}
          />
        </div>
      </Sheet>
    </Screen>
  )
}
