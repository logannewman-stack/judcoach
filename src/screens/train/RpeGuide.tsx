import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, SectionHeader } from '../../components/Bits'
import { Button, Segmented } from '../../components/ios/Controls'
import { RPE_DESCRIPTIONS } from '../../components/NumberPad'
import { useStore } from '../../store/useStore'
import { MAIN_LIFTS, exerciseShortName } from '../../data/exercises'
import { RPE_CHART, formatRir, loadFor, roundToIncrement, rpeToRir } from '../../domain/strength'
import { num } from '../../lib/format'
import { useNav } from '../../nav/nav'
import '../../styles/log.css'

const REPS = [1, 2, 3, 4, 5, 6, 8, 10, 12]
const RPES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6']
/* The ramp's own stops, cool to hot — the five base.css actually paints, not
   the nine steps the scale is read in. */
const BANDS = ['6', '7', '8', '9', '10']

export function RpeGuide() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const profile = useStore((s) => s.profile)
  const [mode, setMode] = useState<'percent' | 'weight'>('percent')
  const [liftId, setLiftId] = useState(MAIN_LIFTS[0]!.id)
  const tm = profile.trainingMaxes[liftId] ?? 0
  // Without a working max every one of the eighty-one cells is an em dash, and
  // a grid of dashes under a heading that promises pounds is the app pretending
  // to have done arithmetic it could not do.
  const priced = mode === 'weight' && tm > 0
  const liftName = MAIN_LIFTS.find((l) => l.id === liftId)?.name.toLowerCase() ?? 'lift'

  const cell = (rpe: string, reps: number) => {
    const pct = RPE_CHART[rpe]![reps - 1]!
    if (mode === 'percent') return `${num(pct, 1)}`
    return num(roundToIncrement(loadFor(tm, reps, Number(rpe)), profile.roundingIncrement), 0)
  }

  return (
    <Screen
      title="RPE & RIR"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 18 }}>
          <div className="t-subhead dim" style={{ lineHeight: '21px' }}>
            RPE is how hard a set was, on a scale that ends at ten. RIR is the same information said
            backwards: how many reps you left behind. RIR = 10 − RPE, always.
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* ------------------------------ the scale ---------------------------
            Nine steps in the five colours the app gives them: base.css pairs
            each whole point with its half, so 8 and 8.5 are one band. The ramp
            leads the card at full strength because reading this page is what
            makes every logged set on every other screen legible without a
            number being read — and a page that drew nine rows in five colours
            while calling them nine taught the opposite. */}
        <div>
          <SectionHeader title="What each number means" />
          <Card>
            <div className="scale-ramp" role="img" aria-label="The effort ramp, cool at six to hot at ten">
              {BANDS.map((band) => (
                <span key={band} className="scale-band" data-rpe={band}>
                  <span className="scale-band-swatch" />
                  <span className="scale-band-key">{band}</span>
                </span>
              ))}
            </div>
            <div className="t-caption1 dim" style={{ marginBottom: 10 }}>
              Five colours, cool to hot. Each one covers a whole point and the half above it.
            </div>
            {RPES.map((rpe) => (
              <div key={rpe} className="scale-row" data-rpe={rpe}>
                <span className="scale-step">{rpe}</span>
                <span className="scale-rir">{formatRir(rpeToRir(Number(rpe)))}</span>
                <span className="t-subhead" style={{ minWidth: 0 }}>
                  {RPE_DESCRIPTIONS[rpe]}
                </span>
              </div>
            ))}
          </Card>
          <div className="list-footer">
            A set you log takes the colour of its band, here and everywhere else —
            so a session's hard end is visible before a single figure is read.
          </div>
        </div>

        {/* -------------------------------- chart ----------------------------- */}
        <div>
          <SectionHeader title="The percentages behind it" />
          <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
            <Segmented
              options={[
                { value: 'percent', label: '% of 1RM' },
                { value: 'weight', label: `Your ${profile.units}` },
              ]}
              value={mode}
              onChange={(v) => setMode(v as 'percent' | 'weight')}
              label="Show the chart as"
            />
            {mode === 'weight' && (
              <Segmented
                options={MAIN_LIFTS.map((lift) => ({ value: lift.id, label: exerciseShortName(lift.id) }))}
                value={liftId}
                onChange={setLiftId}
                label="Lift"
              />
            )}
          </div>

          {mode === 'weight' && !priced ? (
            <Card>
              <div className="t-subhead" style={{ lineHeight: '21px', color: 'var(--label-2)' }}>
                <span className="semibold" style={{ color: 'var(--label)' }}>
                  No working max on file for the {liftName}.
                </span>{' '}
                Every load in this chart is a percentage of one, so there is nothing to price the
                rows in yet. Set it and the whole grid turns into pounds on the bar — the same
                numbers the runner will put in front of you.
              </div>
              <div style={{ marginTop: 14 }}>
                <Button variant="tinted" icon="target" onPress={() => push('trainingMaxes')}>
                  Set your working maxes
                </Button>
              </div>
            </Card>
          ) : (
            <div className="card" style={{ padding: '10px 0 0' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="rpe-table">
                  <thead>
                    <tr>
                      <th className="eyebrow rpe-table-corner" scope="col">RPE</th>
                      {REPS.map((r) => (
                        <th key={r} scope="col">{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RPES.map((rpe) => (
                      <tr key={rpe}>
                        {/* The row is found by its colour rather than by counting
                            down from the top — the same colour the set chip that
                            sent you here was wearing. */}
                        <th className="rpe-table-row-head" scope="row" data-rpe={rpe}>{rpe}</th>
                        {REPS.map((r) => (
                          <td key={r}>{cell(rpe, r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="t-caption1 dim" style={{ padding: '10px 14px 12px' }}>
                Columns are reps. {mode === 'percent'
                  ? 'Values are percentages of a true one-rep max.'
                  : `Values use your ${liftName} working max of ${num(tm, 0)} ${profile.units}.`}
              </div>
            </div>
          )}
        </div>

        <div className="gutter">
          <Card style={{ margin: 0, width: '100%' }}>
            <div className="t-subhead" style={{ lineHeight: '21px', color: 'var(--label-2)' }}>
              <span className="semibold" style={{ color: 'var(--label)' }}>Reading it: </span>
              five reps at RPE 8 means five reps with two left in the tank — historically about 81% of a
              true single. That is why your logged RPE matters as much as the load: it tells Jud what the
              percentage actually cost you.
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  )
}
