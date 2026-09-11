import { useEffect, useRef, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Segmented } from '../../components/ios/Controls'
import { NumberPad } from '../../components/NumberPad'
import { Alert, Sheet } from '../../components/ios/Sheet'
import { useStore } from '../../store/useStore'
import { lengthUnit } from '../../domain/units'
import type { Units } from '../../domain/types'
import { fixed, num, pluralize, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'
import { toast } from '../../components/ios/Toast'

type Field = 'startWeight' | 'goalWeight' | 'weeklyRateTarget' | 'heightIn' | 'birthYear' | null

/**
 * What the front page calls this client's goal.
 *
 * One rule, used here and by the setup flow, because the label is a sentence
 * about the rate: written once at setup and then never again, it went on saying
 * "Lean gain" over a client who had since told the app they were cutting.
 */
export function goalLabelFor(weeklyRateTarget: number, units: Units): string {
  if (Math.abs(weeklyRateTarget) < 0.05) return 'Maintaining'
  return `${weeklyRateTarget > 0 ? 'Lean gain' : 'Cut'} · ${num(Math.abs(weeklyRateTarget), 2)} ${units} / week`
}

/** A weight the client has not given yet asks for itself rather than stating 0. */
const AddValue = <span className="t-subhead semibold tint">Add</span>

export function ProfileSettings() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const setUnits = useStore((s) => s.setUnits)
  const [field, setField] = useState<Field>(null)
  const [naming, setNaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile.name)
  const nameField = useRef<HTMLInputElement>(null)
  const [switchingTo, setSwitchingTo] = useState<Units | null>(null)
  // Select primitives, not a fresh object — zustand v5 snapshots must be stable.
  const weighInCount = useStore((s) => s.weighIns.length)
  const logCount = useStore((s) => s.logs.length)
  const checkInCount = useStore((s) => s.checkIns.length)
  const measurementCount = useStore((s) => s.measurements.length)
  const hasActive = useStore((s) => s.active != null)

  /**
   * Switching units rewrites the client's whole history, so it is spelled out in
   * their own numbers first. Nothing with a count of zero is listed: a client on
   * day one should not be warned about no weigh-ins.
   */
  const affected = (
    [
      [weighInCount, 'weigh-in'],
      [logCount, 'workout'],
      [checkInCount, 'check-in'],
      [measurementCount, 'tape entry', 'tape entries'],
    ] as [number, string, string?][]
  )
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => pluralize(n, one, many))

  const applySwitch = (next: Units) => {
    setSwitchingTo(null)
    if (setUnits(next)) {
      toast(`Switched to ${next}`, { icon: 'swap' })
      return
    }
    // Refused rather than half-applied — see domain/units.ts.
    toast("Couldn't convert every number, so nothing changed", {
      icon: 'xmark.circle.fill',
      tone: 'bad',
    })
  }

  /**
   * The three numbers of a bodyweight goal move together: the rate's direction
   * is a fact about the two weights, not something the keypad can be asked for,
   * and the label is a sentence about the rate. Written one at a time they
   * drift — and because NumberPad submits its `initial` when nothing was typed,
   * opening the rate pad on `Math.abs(rate)` and tapping Done was enough to
   * turn a client's cut into a bulk and have the Weigh-In screen tell them they
   * were moving the wrong way.
   */
  const setGoal = (patch: { startWeight?: number; goalWeight?: number; rate?: number }) => {
    const startWeight = patch.startWeight ?? profile.startWeight
    const goalWeight = patch.goalWeight ?? profile.goalWeight
    const magnitude = Math.abs(patch.rate ?? profile.weeklyRateTarget)
    const weeklyRateTarget = goalWeight > 0 && goalWeight < startWeight ? -magnitude : magnitude
    updateProfile({
      startWeight,
      goalWeight,
      weeklyRateTarget,
      goalLabel: goalLabelFor(weeklyRateTarget, profile.units),
    })
  }

  const saveName = () => {
    if (nameDraft.trim()) updateProfile({ name: nameDraft.trim() })
    setNaming(false)
  }

  // The sheet deliberately takes focus itself on the next frame, so the keyboard
  // cannot rise over a panel that is still sliding (Sheet.tsx). `autoFocus` lost
  // that race and never fired at all, leaving the client to tap the one field on
  // a sheet they opened to type in; this asks for focus once the panel has
  // landed instead.
  useEffect(() => {
    if (!naming) return
    const id = window.setTimeout(() => nameField.current?.focus(), 380)
    return () => window.clearTimeout(id)
  }, [naming])

  // Nothing on file is not a measurement of nothing: a height of 0′ 0″ and an
  // age of 2026 are both what an unset field looks like once it is formatted.
  const heightText = profile.heightIn > 0
    ? `${Math.floor(profile.heightIn / 12)}′ ${Math.round(profile.heightIn % 12)}″`
    : 'Not set'
  const age = profile.birthYear > 0 ? String(new Date().getFullYear() - profile.birthYear) : 'Not set'

  return (
    <Screen title="Profile" back={{ onPress: pop }}>
      <ListSection header="You">
        <Row
          title="Name"
          value={profile.name || AddValue}
          chevron
          onPress={() => { setNameDraft(profile.name); setNaming(true) }}
        />
        <Row title="Height" value={heightText} chevron onPress={() => setField('heightIn')} />
        <Row title="Age" value={age} chevron onPress={() => setField('birthYear')} />
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

      <ListSection
        header="Units"
        footer={`Changing units converts everything GRIT has recorded — weigh-ins, logged sets, the tape, your working maxes and your plate rack — not just the label on it. The tape is in ${lengthUnit(profile.units) === 'cm' ? 'centimetres' : 'inches'}.`}
      >
        <div style={{ padding: '10px var(--gutter)' }}>
          <Segmented
            options={[
              { value: 'lb', label: 'Pounds' },
              { value: 'kg', label: 'Kilograms' },
            ]}
            value={profile.units}
            onChange={(v) => setSwitchingTo(v as Units)}
          />
        </div>
      </ListSection>

      <ListSection
        header="Bodyweight goal"
        footer="Jud compares your 7-day average against this rate every week. It is the number that decides whether calories move."
      >
        <Row
          title="Starting weight"
          value={profile.startWeight > 0 ? `${fixed(profile.startWeight, 1)} ${profile.units}` : AddValue}
          chevron
          onPress={() => setField('startWeight')}
        />
        <Row
          title="Goal weight"
          value={profile.goalWeight > 0 ? `${fixed(profile.goalWeight, 1)} ${profile.units}` : AddValue}
          chevron
          onPress={() => setField('goalWeight')}
        />
        {/* `signed` — the app's own, which prefixes a true minus sign. Spelling
            the sign out here printed an ASCII hyphen next to the U+2212 the
            Weigh-In pill uses for the very same number. */}
        <Row
          title="Target rate"
          value={`${signed(profile.weeklyRateTarget, 2)} ${profile.units}/wk`}
          chevron
          onPress={() => setField('weeklyRateTarget')}
        />
        <Row title="Goal label" value={profile.goalLabel || 'Not set'} />
      </ListSection>

      <NumberPad
        open={field === 'startWeight'}
        onClose={() => setField(null)}
        onSubmit={(v) => setGoal({ startWeight: v })}
        title="Starting weight"
        initial={profile.startWeight}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
      <NumberPad
        open={field === 'goalWeight'}
        onClose={() => setField(null)}
        onSubmit={(v) => setGoal({ goalWeight: v })}
        title="Goal weight"
        initial={profile.goalWeight}
        unit={profile.units}
        steps={[-5, -1, 1, 5]}
      />
      <NumberPad
        open={field === 'weeklyRateTarget'}
        onClose={() => setField(null)}
        onSubmit={(v) => setGoal({ rate: v })}
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
        right={{ label: 'Save', strong: true, disabled: !nameDraft.trim(), onPress: saveName }}
        detent={0.4}
      >
        <div style={{ padding: '8px 16px 16px' }}>
          <input
            ref={nameField}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            autoCapitalize="words"
            // The key commits, so it says so — and a single-line field takes the
            // field radius, not the capsule a button wears.
            enterKeyHint="done"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 'var(--r-field)',
              border: 'none', background: 'var(--fill-3)',
            }}
          />
        </div>
      </Sheet>

      <Alert
        open={switchingTo != null}
        title={`Switch to ${switchingTo === 'kg' ? 'kilograms' : 'pounds'}?`}
        message={
          switchingTo && (
            <>
              Every number GRIT holds gets converted, not relabelled
              {affected.length > 0 ? `: ${affected.join(', ')}` : ''}, plus your working maxes. The
              tape moves to {switchingTo === 'kg' ? 'centimetres' : 'inches'} and your bar and plates
              become a {switchingTo === 'kg' ? 'kilo' : 'pound'} rack.
              {hasActive && ' The workout you have in progress comes with it.'} Rounding means a
              switch back can land a tenth either side of where you started.
            </>
          )
        }
        onDismiss={() => setSwitchingTo(null)}
        actions={[
          { label: 'Cancel', onPress: () => setSwitchingTo(null) },
          {
            label: `Convert to ${switchingTo ?? ''}`,
            strong: true,
            onPress: () => switchingTo && applySwitch(switchingTo),
          },
        ]}
      />
    </Screen>
  )
}
