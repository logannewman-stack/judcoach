import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState } from '../../components/Bits'
import { Button, Segmented } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { NumberPad } from '../../components/NumberPad'
import { LineChart } from '../../components/Charts'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { MeasurementEntry, Units } from '../../domain/types'
import { formatLength, lengthUnit, tapeSteps } from '../../domain/units'
import { formatMediumDate, formatShortDate, relativeDay, todayISO } from '../../lib/date'
import { num, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'

type SiteKey = 'waist' | 'chest' | 'arm' | 'thigh' | 'hips' | 'neck'

const SITES: { key: SiteKey; label: string; hint: string }[] = [
  { key: 'waist', label: 'Waist', hint: 'At the navel, relaxed — do not suck in.' },
  { key: 'chest', label: 'Chest', hint: 'At nipple line, arms down, end of a normal exhale.' },
  { key: 'arm', label: 'Arm', hint: 'Mid-bicep, flexed, same arm every time.' },
  { key: 'thigh', label: 'Thigh', hint: 'Halfway between hip crease and knee.' },
  { key: 'hips', label: 'Hips', hint: 'Widest point across the glutes.' },
  { key: 'neck', label: 'Neck', hint: 'Just below the larynx.' },
]

export function Measurements() {
  const pop = useNav((s) => s.pop)
  const measurements = useStore((s) => s.measurements)
  const saveMeasurement = useStore((s) => s.saveMeasurement)
  // The tape follows the weight unit, so the numbers and the label can never
  // disagree about which one they are in.
  const units = useStore((s) => s.profile.units)
  const [site, setSite] = useState<SiteKey>('waist')
  const [adding, setAdding] = useState(false)

  const series = useMemo(
    () =>
      measurements
        .filter((m) => m[site] != null)
        .map((m) => ({ x: m.date, y: m[site] as number }))
        .sort((a, b) => a.x.localeCompare(b.x)),
    [measurements, site],
  )
  const latest = series[series.length - 1]
  const first = series[0]
  const meta = SITES.find((s) => s.key === site)!

  return (
    <Screen
      title="Measurements"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">The tape catches what the scale misses.</div>
        </div>
      }
      right={{ icon: 'plus', onPress: () => setAdding(true), ariaLabel: 'Add measurements' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {measurements.length === 0 ? (
          <EmptyState
            icon="ruler"
            title="Nothing measured yet"
            message="Take them first thing, same day of the week, same tape tension."
            action={<Button small onPress={() => setAdding(true)}>Add measurements</Button>}
          />
        ) : (
          <>
            {/* Every site you can record is a site you can read back. */}
            <div className="gutter">
              <Segmented
                options={SITES.map((s) => ({ value: s.key, label: s.label }))}
                value={site}
                onChange={(v) => setSite(v as SiteKey)}
                label="Measurement site"
              />
            </div>

            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="t-footnote dim">{meta.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span className="mono-nums" style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8 }}>
                      {latest ? num(latest.y, 1) : '—'}
                    </span>
                    <span className="t-callout dim">{lengthUnit(units)}</span>
                  </div>
                </div>
                {first && latest && first !== latest && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="t-footnote dim">Since {formatShortDate(first.x)}</div>
                    <div
                      className="t-title3 mono-nums"
                      style={{ color: latest.y >= first.y ? 'var(--green)' : 'var(--orange)' }}
                    >
                      {signed(latest.y - first.y, 1)}{units === 'kg' ? ' cm' : '″'}
                    </div>
                  </div>
                )}
              </div>
              {series.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <LineChart
                    data={series}
                    height={160}
                    showDots
                    formatValue={(v) => formatLength(v, units)}
                    formatLabel={(x) => formatShortDate(x)}
                    ariaLabel={`${meta.label} over time`}
                  />
                </div>
              ) : (
                // An empty chart says nothing; say what's missing instead.
                <div className="t-subhead dim" style={{ marginTop: 8 }}>
                  Nothing recorded here yet — add it next time you take the tape out.
                </div>
              )}
              <div className="t-caption1 dim" style={{ marginTop: 8 }}>{meta.hint}</div>
            </Card>

            <ListSection header="History" style={{ marginBottom: 0 }}>
              {[...measurements].reverse().map((entry) => (
                <Row
                  key={entry.date}
                  title={relativeDay(entry.date)}
                  subtitle={formatMediumDate(entry.date)}
                  value={
                    <span className="mono-nums">
                      {SITES.filter((s) => entry[s.key] != null)
                        .slice(0, 3)
                        .map((s) => `${s.label[0]} ${num(entry[s.key] as number, 1)}`)
                        .join(' · ')}
                    </span>
                  }
                />
              ))}
            </ListSection>
          </>
        )}
      </div>

      <AddMeasurementSheet
        open={adding}
        onClose={() => setAdding(false)}
        units={units}
        latest={measurements[measurements.length - 1]}
        onSave={(entry) => {
          saveMeasurement(entry)
          toast('Measurements saved', { icon: 'ruler', tone: 'good' })
        }}
      />
    </Screen>
  )
}

function AddMeasurementSheet({
  open, onClose, units, latest, onSave,
}: {
  open: boolean
  onClose: () => void
  units: Units
  latest?: MeasurementEntry
  onSave: (entry: MeasurementEntry) => void
}) {
  const [draft, setDraft] = useState<MeasurementEntry>({ date: todayISO() })
  const [editing, setEditing] = useState<SiteKey | null>(null)

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="New measurements"
        left={{ label: 'Cancel', onPress: onClose }}
        right={{
          label: 'Save',
          strong: true,
          onPress: () => {
            onSave({ ...draft, date: todayISO() })
            setDraft({ date: todayISO() })
            onClose()
          },
        }}
        detent={0.8}
      >
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="t-footnote dim" style={{ marginBottom: 12 }}>
            {units === 'kg' ? 'Centimetres' : 'Inches'}. Leave anything blank that you didn't take.
          </div>
          <div className="card" style={{ margin: 0 }}>
            {SITES.map((s) => (
              <Row
                key={s.key}
                title={s.label}
                subtitle={
                  latest?.[s.key] != null
                    ? `Last: ${formatLength(latest[s.key] as number, units)}`
                    : undefined
                }
                value={draft[s.key] != null ? formatLength(draft[s.key] as number, units) : 'Add'}
                chevron
                onPress={() => setEditing(s.key)}
              />
            ))}
          </div>
        </div>
      </Sheet>

      {editing && (
        <NumberPad
          open={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => setDraft((d) => ({ ...d, [editing]: v }))}
          title={SITES.find((s) => s.key === editing)!.label}
          initial={draft[editing] ?? latest?.[editing] ?? 0}
          unit={lengthUnit(units)}
          steps={tapeSteps(units)}
          hint={SITES.find((s) => s.key === editing)!.hint}
        />
      )}
    </>
  )
}
