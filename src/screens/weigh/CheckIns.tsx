import { useEffect, useMemo, useRef, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Row } from '../../components/ios/List'
import { Button, Pill, Segmented } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { NumberPad } from '../../components/NumberPad'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { Units } from '../../domain/types'
import { rollingSeries } from '../../domain/weight'
import { formatMediumDate, relativeTime, todayISO } from '../../lib/date'
import { fixed } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'
import { CoachNotes } from '../../components/CoachNotes'
import { COACH } from '../../data/seed'
import { AVG_MIN_READINGS } from './WeighInHome'

const SCALES = [
  { key: 'sleepQuality' as const, label: 'Sleep', low: 'Wrecked', high: 'Excellent' },
  { key: 'energy' as const, label: 'Energy', low: 'Flat', high: 'Buzzing' },
  { key: 'soreness' as const, label: 'Soreness', low: 'None', high: 'Beaten up' },
]

/** One of five, which is a segmented control's job and not five buttons'. */
const SCALE_STEPS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

/** What the sheet may offer as the week's bodyweight, and what it may call it. */
interface WeightSeed {
  value: number
  /** How the figure was arrived at. Never "your 7-day average" unless it is one. */
  note: string
}

export function CheckIns({ focus }: { focus?: string } = {}) {
  const pop = useNav((s) => s.pop)
  const checkIns = useStore((s) => s.checkIns)
  const addCheckIn = useStore((s) => s.addCheckIn)
  const weighIns = useStore((s) => s.weighIns)
  const profile = useStore((s) => s.profile)
  const decimals = useStore((s) => s.settings.weightUnitDecimals)
  const [composing, setComposing] = useState(false)

  /* The one figure Jud reads first, and the one this sheet used to invent. It
     offered `trend?.current ?? profile.startWeight` and announced whatever came
     back as "your 7-day average": nought for a client with no start weight on
     file, and a months-old starting weight for one whose weigh-ins had been
     cleared. So the seed carries how it was arrived at, the rolling average is
     only called one where it rests on enough mornings to be one — the same
     threshold the Weigh-In card refuses below — and a client with nothing on
     file is offered nothing and asked instead. */
  const seed = useMemo<WeightSeed | null>(() => {
    const series = rollingSeries(weighIns, 7)
    const last = series[series.length - 1]
    if (!last) return null
    if (last.count >= AVG_MIN_READINGS) return { value: last.avg, note: 'Your 7-day average' }
    return { value: last.weight, note: `Your weigh-in from ${relativeTime(last.date).lower}` }
  }, [weighIns])

  const sorted = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Screen
      title="Check-ins"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">
            Sunday nights. This is what Jud reads before changing anything.
          </div>
        </div>
      }
      right={{ icon: 'plus', onPress: () => setComposing(true), ariaLabel: 'New check-in' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {sorted.length === 0 ? (
          // One call to action, not two: the empty state carries it until
          // there's a history for the button to sit above.
          <EmptyState
            icon="note"
            title="No check-ins yet"
            message="Two minutes on a Sunday buys you a programme that actually adapts."
            action={
              <Button small icon="pencil" onPress={() => setComposing(true)}>
                Write your first check-in
              </Button>
            }
          />
        ) : (
          <>
            <div className="gutter">
              <Button icon="pencil" onPress={() => setComposing(true)}>
                Write this week's check-in
              </Button>
            </div>

            <div>
              <SectionHeader title="History" />
              <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sorted.map((entry, i) => {
                  const when = relativeTime(entry.date)
                  return (
                    <div key={entry.id} className="card" style={{ margin: 0, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <span className="t-headline">{when.label}</span>
                        {/* Older entries already read as a date — don't print it twice. */}
                        {when.kind !== 'date' && (
                          <span className="t-footnote dim">{formatMediumDate(entry.date)}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                        {/* A check-in written before the sheet had a weight
                            field carries a nought, which is not a bodyweight
                            and must not be printed as one. */}
                        {entry.weight > 0 && (
                          <Pill tone="tinted">{fixed(entry.weight, decimals)} {profile.units}</Pill>
                        )}
                        <Pill>Sleep {entry.sleepQuality}/5</Pill>
                        <Pill>Energy {entry.energy}/5</Pill>
                        <Pill>Soreness {entry.soreness}/5</Pill>
                        <Pill tone={entry.adherence >= 90 ? 'good' : entry.adherence >= 75 ? 'warn' : 'bad'}>
                          {entry.adherence}% adherence
                        </Pill>
                      </div>

                      {entry.note && (
                        <div className="t-subhead" style={{ marginTop: 11, lineHeight: '21px' }}>
                          {entry.note}
                        </div>
                      )}

                      {/* Jud's reply is a real message, so the client can answer it. */}
                      <div style={{ marginTop: 12 }}>
                        <CoachNotes
                          spotlight={focus === 'notes' && i === 0}
                          anchor={{ kind: 'checkIn', id: entry.id }}
                          empty={`Waiting on ${COACH.name}.`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <ComposeSheet
        open={composing}
        onClose={() => setComposing(false)}
        seed={seed}
        units={profile.units}
        decimals={decimals}
        onSubmit={(entry) => {
          addCheckIn(entry)
          haptic('success')
          /* Not "Sent to Jud". `addCheckIn` appends to this device and there is
             no transport in the app to send it down — which the footnote at the
             bottom of the same sheet says in as many words. */
          toast('Check-in saved', { icon: 'note', tone: 'good' })
        }}
      />
    </Screen>
  )
}

function ComposeSheet({
  open, onClose, seed, units, decimals, onSubmit,
}: {
  open: boolean
  onClose: () => void
  seed: WeightSeed | null
  units: Units
  decimals: number
  onSubmit: (entry: {
    date: string
    weight: number
    sleepQuality: number
    energy: number
    soreness: number
    adherence: number
    note?: string
  }) => void
}) {
  const [values, setValues] = useState({ sleepQuality: 3, energy: 3, soreness: 2 })
  const [adherence, setAdherence] = useState(90)
  const [note, setNote] = useState('')
  const [weight, setWeight] = useState<number | null>(null)
  const [typed, setTyped] = useState(false)
  const [editingWeight, setEditingWeight] = useState(false)

  // The sheet is mounted long before it is opened and the seed moves with the
  // weigh-ins behind it, so the figure is taken at the moment it is presented.
  useEffect(() => {
    if (!open) return
    setWeight(seed ? Math.round(seed.value * 10) / 10 : null)
    setTyped(false)
  }, [open, seed])

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Weekly check-in"
        left={{ label: 'Cancel', onPress: onClose }}
        right={{
          // "Send" over a sheet whose own footnote says nothing leaves the
          // phone. It is saved here until the client exports it.
          label: 'Save',
          strong: true,
          disabled: weight == null,
          onPress: () => {
            if (weight == null) return
            onSubmit({
              date: todayISO(),
              weight,
              ...values,
              adherence,
              note: note.trim() || undefined,
            })
            setNote('')
            onClose()
          },
        }}
        detent={0.9}
      >
        <div style={{ padding: '4px 16px 16px' }}>
          {/* The figure a coach reads before changing anything, and the only one
              on the sheet the app cannot work out on its own. It is offered
              where there is something to offer, named for what it actually is,
              and editable either way. */}
          <div className="card" style={{ margin: '0 0 18px' }}>
            <Row
              title="Bodyweight"
              subtitle={
                weight == null
                  ? "No weigh-in on file — tap to add today's"
                  : typed ? undefined : seed?.note
              }
              value={
                weight != null
                  ? <span className="data">{fixed(weight, decimals)} {units}</span>
                  : 'Add'
              }
              chevron
              onPress={() => setEditingWeight(true)}
            />
          </div>

          {SCALES.map((scale) => (
            <div key={scale.key} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span className="t-subhead semibold">{scale.label}</span>
                <span className="t-footnote dim">
                  {values[scale.key] <= 2 ? scale.low : values[scale.key] >= 4 ? scale.high : 'Middling'}
                </span>
              </div>
              {/* One of five mutually exclusive values is a segmented control.
                  Five loose buttons cost five tab stops, stood 42pt tall, and
                  said which one was chosen in fill colour alone — no role, no
                  aria-checked, nothing a reader could hear. */}
              <Segmented
                options={SCALE_STEPS}
                value={String(values[scale.key])}
                onChange={(v) => setValues((s) => ({ ...s, [scale.key]: Number(v) }))}
                label={scale.label}
              />
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span className="t-subhead semibold">Nutrition adherence</span>
              <span className="t-footnote data dim">{adherence}%</span>
            </div>
            <Slider
              value={adherence}
              min={0}
              max={100}
              step={5}
              onChange={setAdherence}
              label="Nutrition adherence"
              valueText={`${adherence} percent`}
            />
          </div>

          <div className="t-subhead semibold" style={{ marginBottom: 7 }}>
            Anything Jud should know
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Sleep, stress, aches, travel, a lift that felt different…"
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 'var(--r-card)',
              border: 'none', background: 'var(--fill-3)', resize: 'none', lineHeight: '22px',
            }}
          />

          <div
            className="t-caption1 dim"
            style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}
          >
            <Icon name="info" size={13} weight={2} color="var(--label-3)" style={{ marginTop: 2 }} />
            Check-ins are stored on this device for now. Jud sees them when you share your export.
          </div>
        </div>
      </Sheet>

      {editingWeight && (
        <NumberPad
          open={editingWeight}
          onClose={() => setEditingWeight(false)}
          // Nobody weighs nothing. The pad opens on zero where there is no
          // reading to seed it from and hands that zero straight back, which is
          // the figure this sheet used to file as the client's bodyweight.
          onSubmit={(v) => {
            if (v <= 0) return
            setWeight(Math.round(v * 10) / 10)
            setTyped(true)
          }}
          title="This week's weight"
          initial={weight ?? 0}
          unit={units}
          steps={[-1, -0.2, 0.2, 1]}
          hint="The morning figure Jud reads the week against."
        />
      )}
    </>
  )
}

/**
 * A slider the way UIKit draws one: a 4pt rounded track under a 28pt thumb with
 * a contact shadow, dragged from anywhere along a row a finger's height.
 *
 * The browser's own `input[type=range]` was the last stock form control left in
 * an app that hand-builds its switch, stepper, segmented control and keypad. It
 * measured 16pt from top to bottom, so a thumb aimed at with a finger missed it,
 * and `accentColor` was the only thing about it this app had any say over.
 */
function Slider({
  value, min, max, step, onChange, label, valueText,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  label: string
  /** What the number means, for a reader that would otherwise hear "90". */
  valueText: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const fraction = (value - min) / (max - min)

  const settle = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next))
    if (clamped === value) return
    haptic('selection')
    onChange(clamped)
  }

  const at = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const t = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    settle(Math.round((min + t * (max - min)) / step) * step)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={(e) => {
        const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
        if (delta) {
          e.preventDefault()
          settle(value + delta * step)
          return
        }
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault()
          settle(e.key === 'Home' ? min : max)
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        at(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e.clientX)
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      style={{
        display: 'flex',
        alignItems: 'center',
        // A finger's worth of row, and the thumb's own radius at each end so it
        // never hangs off the track it rides.
        minHeight: 44,
        padding: '0 14px',
        touchAction: 'none',
      }}
    >
      <div
        ref={track}
        style={{
          position: 'relative',
          flex: 1,
          height: 4,
          borderRadius: 'var(--r-pill)',
          background: 'var(--fill-3)',
        }}
      >
        {/* Filled in the domain's own hue: this is the client's answer, not the
            screen's primary action. */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${fraction * 100}%`,
            borderRadius: 'var(--r-pill)',
            background: 'var(--tint)',
          }}
        />
        <span
          style={{
            position: 'absolute', top: '50%', left: `${fraction * 100}%`,
            width: 28, height: 28, marginTop: -14, marginLeft: -14,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--shadow-knob)',
          }}
        />
      </div>
    </div>
  )
}
