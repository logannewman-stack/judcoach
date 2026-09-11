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
import { rollingSeries } from '../../domain/weight'
import { formatMediumDate, formatShortDate, relativeDay, todayISO } from '../../lib/date'
import { num, pluralize, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'
import '../../styles/fuel.css'

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
  const weighIns = useStore((s) => s.weighIns)
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

  // What the scale was doing over the same stretch. A waist holding while
  // bodyweight climbs is the whole point of taking the tape out, and neither
  // number says that on its own.
  const weightSpan = useMemo(() => {
    if (!first || !latest || first === latest) return null
    const avg = rollingSeries(weighIns, 7)
    const at = (date: string) => [...avg].reverse().find((p) => p.date <= date)
    const from = at(first.x)
    const to = at(latest.x)
    return from && to && from !== to ? to.avg - from.avg : null
  }, [weighIns, first, latest])

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
                  <div className="eyebrow">{meta.label}</div>
                  {/* A 34px em dash beside a live unit reads as a reading that
                      was taken and withheld. A site nobody has put a tape round
                      has no figure at all, so it gets none — the line below
                      says what is missing and the hint says how to take it. */}
                  {latest && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
                      <span className="figure" style={{ fontSize: 34 }}>{num(latest.y, 1)}</span>
                      <span className="figure-unit" style={{ fontSize: 16 }}>{lengthUnit(units)}</span>
                    </div>
                  )}
                </div>
                {first && latest && first !== latest && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="eyebrow">Since {formatShortDate(first.x)}</div>
                    {/* Left uncoloured on purpose. A bigger arm and a bigger
                        waist are the same arithmetic and opposite news, and the
                        app cannot tell which one this client wanted — a green
                        number here would be a verdict it has not earned. */}
                    <div className="data" style={{ fontSize: 20, lineHeight: '25px', marginTop: 3 }}>
                      {signed(latest.y - first.y, 1)}
                      <span className="data-unit">{units === 'kg' ? ' cm' : '″'}</span>
                    </div>
                  </div>
                )}
              </div>
              {series.length > 1 ? (
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
                <div className="t-subhead dim" style={{ marginTop: latest ? 8 : 4 }}>
                  {series.length === 0
                    ? `No ${meta.label.toLowerCase()} reading on file — add it next time you take the tape out and it starts its own line.`
                    : 'One reading so far. The line appears the second time you take it.'}
                </div>
              )}
              {weightSpan != null && (
                <div className="t-footnote dim" style={{ marginTop: 8 }}>
                  Bodyweight over the same stretch:{' '}
                  <span className="data">
                    {signed(weightSpan, 1)}<span className="data-unit"> {units}</span>
                  </span>
                </div>
              )}
              <div className="t-caption1 dim" style={{ marginTop: 8 }}>{meta.hint}</div>
            </Card>

            {/* The screen is one site at a time — the control picks it, the
                chart plots it, the hint says how to take it — so the list under
                it is that site's readings, not a digest of three others. Three
                abbreviated sites in a row's value column wrapped to two lines
                the moment type scaled up, and on the Thigh tab none of the
                three was a thigh. */}
            {series.length > 0 && (
              <ListSection
                header={`${meta.label} history`}
                footer={
                  measurements.length > series.length
                    ? `${pluralize(measurements.length - series.length, 'other session')} carried no ${meta.label.toLowerCase()} reading.`
                    : undefined
                }
                style={{ marginBottom: 0 }}
              >
                {[...series].reverse().map((point) => {
                  const title = relativeDay(point.x)
                  return (
                    <Row
                      key={point.x}
                      title={title}
                      // Older rows already read as a date — don't print it twice.
                      subtitle={
                        formatMediumDate(point.x).endsWith(title)
                          ? undefined
                          : formatMediumDate(point.x)
                      }
                      value={
                        <span className="data">
                          {num(point.y, 1)}
                          <span className="data-unit"> {lengthUnit(units)}</span>
                        </span>
                      }
                    />
                  )
                })}
              </ListSection>
            )}
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
                    ? <>Last: <span className="data">{formatLength(latest[s.key] as number, units)}</span></>
                    : undefined
                }
                value={
                  draft[s.key] != null
                    ? <span className="data">{formatLength(draft[s.key] as number, units)}</span>
                    : 'Add'
                }
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
