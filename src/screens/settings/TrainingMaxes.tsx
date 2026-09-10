import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import { NumberPad } from '../../components/NumberPad'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import { e1rmSeries } from '../../store/selectors'
import { MAIN_LIFTS } from '../../data/exercises'
import { roundToIncrement } from '../../domain/strength'
import { Sparkline } from '../../components/Charts'
import { fixed, num, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'

export function TrainingMaxes() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const logs = useStore((s) => s.logs)
  const setTrainingMax = useStore((s) => s.setTrainingMax)
  const [editing, setEditing] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      MAIN_LIFTS.map((lift) => {
        const tm = profile.trainingMaxes[lift.id] ?? 0
        const series = e1rmSeries(logs, lift.id)
        const best = series.reduce((b, p) => Math.max(b, p.value), 0)
        // The working max *is* the one-rep max estimate — every percentage in
        // the programme is derived from it through the RPE chart, so taking a
        // further 10% off would ratchet the whole block down each cycle.
        const suggested = best > 0 ? roundToIncrement(best, profile.roundingIncrement) : 0
        return { lift, tm, series, best, suggested, gap: suggested - tm }
      }),
    [profile.trainingMaxes, profile.roundingIncrement, logs],
  )

  const stale = rows.filter((r) => r.suggested > 0 && r.gap >= profile.roundingIncrement * 2)

  return (
    <Screen
      title="Working maxes"
      back={{ label: 'Settings', onPress: pop }}
      titleAccessory={
        <div className="gutter t-subhead dim" style={{ margin: '-2px 0 24px', lineHeight: '21px' }}>
          The most you can lift for one rep right now. Every percentage in the programme is a slice
          of these numbers, worked out through the RPE chart, so the load and the effort it asks for
          always agree.
        </div>
      }
    >
      {stale.length > 0 && (
        <ListSection>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px var(--gutter)' }}>
            <Icon name="arrow.up" size={18} weight={2.4} color="var(--green)" style={{ marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div className="t-headline">You've outgrown some numbers</div>
              <div className="t-footnote dim" style={{ marginTop: 2 }}>
                {stale.map((r) => r.lift.shortName ?? r.lift.name).join(', ')}
                {stale.length === 1 ? ' is' : ' are'} lagging what you're actually lifting.
                Tap a lift below to update it.
              </div>
            </div>
          </div>
        </ListSection>
      )}

      <ListSection
        header="Main lifts"
        footer="Taken from your best near-maximal set — six reps or fewer at RPE 8 or above. Ordinary percentage work sits below a true max, so treat these as a floor; only a number above your working max means it is time to move."
      >
        {rows.map(({ lift, tm, series, best, suggested, gap }) => (
          <Row
            key={lift.id}
            title={lift.name}
            subtitle={
              best > 0
                ? `Best e1RM ${num(best, 0)} ${profile.units}${
                    suggested > 0 ? ` · logs support ${num(suggested, 0)}+` : ''
                  }`
                : 'No logged sets yet'
            }
            value={`${fixed(tm, 0)} ${profile.units}`}
            trailing={
              <>
                {series.length > 2 && (
                  <Sparkline
                    values={series.slice(-12).map((p) => p.value)}
                    width={46}
                    height={20}
                    color={gap > 0 ? 'var(--green)' : 'var(--label-3)'}
                  />
                )}
                {gap >= profile.roundingIncrement * 2 && <Pill tone="good">{signed(gap, 0)}</Pill>}
              </>
            }
            chevron
            onPress={() => setEditing(lift.id)}
          />
        ))}
      </ListSection>

      <ListSection header="How Jud sets them">
        <div
          className="t-subhead"
          style={{ lineHeight: '21px', color: 'var(--label-2)', padding: '13px var(--gutter)' }}
        >
          At the end of every block you work up to a top single, and that becomes your working max
          for the next one. If a top set feels heavier than the RPE asks for two weeks running, the
          max comes down — that is not failure, it is the system working.
        </div>
      </ListSection>

      {editing && (
        <NumberPad
          open={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            setTrainingMax(editing, roundToIncrement(v, profile.roundingIncrement))
            toast('Working max updated', { icon: 'check.circle.fill', tone: 'good' })
          }}
          title={MAIN_LIFTS.find((l) => l.id === editing)?.name ?? 'Working max'}
          initial={profile.trainingMaxes[editing] ?? 0}
          unit={profile.units}
          steps={[-10, -5, 5, 10]}
          hint={(() => {
            const row = rows.find((r) => r.lift.id === editing)
            return row && row.suggested > 0
              ? `Your logs support at least ${num(row.suggested, 0)} ${profile.units}`
              : undefined
          })()}
        />
      )}
    </Screen>
  )
}
