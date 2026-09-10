import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { Card, SectionHeader } from '../../components/Bits'
import { Segmented } from '../../components/ios/Controls'
import { RPE_DESCRIPTIONS } from '../../components/NumberPad'
import { useStore } from '../../store/useStore'
import { MAIN_LIFTS } from '../../data/exercises'
import { RPE_CHART, loadFor, roundToIncrement, rpeToRir } from '../../domain/strength'
import { num } from '../../lib/format'
import { useNav } from '../../nav/nav'

const REPS = [1, 2, 3, 4, 5, 6, 8, 10, 12]
const RPES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6']

export function RpeGuide() {
  const pop = useNav((s) => s.pop)
  const profile = useStore((s) => s.profile)
  const [mode, setMode] = useState<'percent' | 'weight'>('percent')
  const [liftId, setLiftId] = useState(MAIN_LIFTS[0]!.id)
  const tm = profile.trainingMaxes[liftId] ?? 0

  const cell = (rpe: string, reps: number) => {
    const row = RPE_CHART[rpe]!
    const idx = reps - 1
    const pct = row[idx]
    if (pct == null) return '—'
    if (mode === 'percent') return `${num(pct, 1)}`
    return num(roundToIncrement(loadFor(tm, reps, Number(rpe)), profile.roundingIncrement), 0)
  }

  return (
    <Screen title="RPE & RIR" back={{ label: 'Train', onPress: pop }} largeTitle={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>RPE &amp; RIR</h1>
          <div className="t-subhead dim" style={{ marginTop: 3, lineHeight: '21px' }}>
            RPE is how hard a set was, on a scale that ends at ten. RIR is the same information said
            backwards: how many reps you left behind. RIR = 10 − RPE, always.
          </div>
        </div>

        {/* ------------------------------ the scale --------------------------- */}
        <div>
          <SectionHeader title="What each number means" />
          <Card>
            {RPES.map((rpe) => (
              <div
                key={rpe}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '7px 0',
                }}
              >
                <span
                  className="mono-nums"
                  style={{
                    width: 44, flex: 'none', textAlign: 'center',
                    padding: '5px 0', borderRadius: 8,
                    background: Number(rpe) >= 9 ? 'rgba(255,59,48,0.14)' : Number(rpe) >= 8 ? 'rgba(255,149,0,0.14)' : 'var(--fill-4)',
                    color: Number(rpe) >= 9 ? 'var(--red)' : Number(rpe) >= 8 ? 'var(--orange)' : 'var(--label-2)',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {rpe}
                </span>
                <span className="mono-nums t-footnote dim" style={{ width: 48, flex: 'none' }}>
                  {num(rpeToRir(Number(rpe)), 1)} RIR
                </span>
                <span className="t-subhead" style={{ minWidth: 0, color: 'var(--label-2)' }}>
                  {RPE_DESCRIPTIONS[rpe]}
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/* -------------------------------- chart ----------------------------- */}
        <div>
          <SectionHeader title="The percentages behind it" />
          <div className="gutter" style={{ marginBottom: 10 }}>
            <Segmented
              options={[
                { value: 'percent', label: '% of 1RM' },
                { value: 'weight', label: `Your ${profile.units}` },
              ]}
              value={mode}
              onChange={(v) => setMode(v as 'percent' | 'weight')}
            />
          </div>

          {mode === 'weight' && (
            <div className="hscroll" style={{ gap: 7, paddingBottom: 10 }}>
              {MAIN_LIFTS.map((lift) => (
                <button
                  key={lift.id}
                  type="button"
                  onClick={() => setLiftId(lift.id)}
                  className="pill"
                  style={{
                    flex: '0 0 auto', padding: '7px 12px', fontSize: 13,
                    background: liftId === lift.id ? 'var(--accent)' : 'var(--fill-3)',
                    color: liftId === lift.id ? '#fff' : 'var(--label-2)',
                  }}
                >
                  {lift.shortName ?? lift.name}
                </button>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: '12px 0' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table
                className="mono-nums"
                style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420, fontSize: 13 }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        ...headCell,
                        position: 'sticky', left: 0,
                        background: 'var(--grouped-2)', zIndex: 1, textAlign: 'left',
                        paddingLeft: 14,
                      }}
                    >
                      RPE
                    </th>
                    {REPS.map((r) => (
                      <th key={r} style={headCell}>{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RPES.map((rpe) => (
                    <tr key={rpe}>
                      <th
                        style={{
                          ...bodyCell,
                          position: 'sticky', left: 0,
                          background: 'var(--grouped-2)', zIndex: 1,
                          fontWeight: 700, textAlign: 'left', paddingLeft: 14,
                        }}
                      >
                        {rpe}
                      </th>
                      {REPS.map((r) => (
                        <td key={r} style={bodyCell}>
                          {mode === 'weight' && tm === 0 ? '—' : cell(rpe, r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="t-caption1 dim" style={{ padding: '10px 14px 0' }}>
              Columns are reps. {mode === 'percent'
                ? 'Values are percentages of a true one-rep max.'
                : `Values use your ${MAIN_LIFTS.find((l) => l.id === liftId)?.name.toLowerCase()} training max of ${num(tm, 0)} ${profile.units}.`}
            </div>
          </div>
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

const headCell: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--label-2)',
  textAlign: 'center',
  borderBottom: '1px solid var(--sep)',
}

const bodyCell: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'center',
  color: 'var(--label)',
  borderBottom: '0.5px solid var(--sep)',
}
