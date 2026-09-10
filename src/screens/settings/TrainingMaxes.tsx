import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, SectionHeader } from '../../components/Bits'
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
        // A training max is conventionally ~90% of a true max.
        const suggested = best > 0 ? roundToIncrement(best * 0.9, profile.roundingIncrement) : 0
        return { lift, tm, series, best, suggested, gap: suggested - tm }
      }),
    [profile.trainingMaxes, profile.roundingIncrement, logs],
  )

  const stale = rows.filter((r) => r.suggested > 0 && r.gap >= profile.roundingIncrement * 2)

  return (
    <Screen title="Training maxes" back={{ label: 'Settings', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>Training maxes</h1>
          <div className="t-subhead dim" style={{ marginTop: 3, lineHeight: '21px' }}>
            Every percentage in the programme is a slice of these numbers. A training max sits around
            90% of a true one-rep max — heavy enough to matter, light enough to hit every week.
          </div>
        </div>

        {stale.length > 0 && (
          <div className="gutter">
            <Card style={{ margin: 0, width: '100%' }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
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
            </Card>
          </div>
        )}

        <ListSection
          header="Main lifts"
          footer="Supported values are 90% of the best estimated max in your logs. Percentage work sits below a true max, so treat them as a floor — only a number above your training max means it is time to move."
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

        <div>
          <SectionHeader title="How Jud sets them" />
          <Card>
            <div className="t-subhead" style={{ lineHeight: '21px', color: 'var(--label-2)' }}>
              At the end of every block you work up to a top single. Ninety percent of that becomes the
              next block's training max. If a top set ever feels heavier than the RPE asks for two weeks
              running, the max comes down — that is not failure, it is the system working.
            </div>
          </Card>
        </div>
      </div>

      {editing && (
        <NumberPad
          open={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            setTrainingMax(editing, roundToIncrement(v, profile.roundingIncrement))
            toast('Training max updated', { icon: 'check.circle.fill', tone: 'good' })
          }}
          title={MAIN_LIFTS.find((l) => l.id === editing)?.name ?? 'Training max'}
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
