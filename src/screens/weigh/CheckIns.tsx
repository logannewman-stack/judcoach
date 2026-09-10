import { useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { CoachAvatar, EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Pill } from '../../components/ios/Controls'
import { Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import { summarizeTrend } from '../../domain/weight'
import { formatMediumDate, relativeDay, todayISO } from '../../lib/date'
import { num } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

const SCALES = [
  { key: 'sleepQuality' as const, label: 'Sleep', low: 'Wrecked', high: 'Excellent' },
  { key: 'energy' as const, label: 'Energy', low: 'Flat', high: 'Buzzing' },
  { key: 'soreness' as const, label: 'Soreness', low: 'None', high: 'Beaten up' },
]

export function CheckIns() {
  const pop = useNav((s) => s.pop)
  const checkIns = useStore((s) => s.checkIns)
  const addCheckIn = useStore((s) => s.addCheckIn)
  const weighIns = useStore((s) => s.weighIns)
  const profile = useStore((s) => s.profile)
  const [composing, setComposing] = useState(false)

  const trend = summarizeTrend(weighIns, 28)
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
        <div className="gutter">
          <Button icon="pencil" onPress={() => setComposing(true)}>
            Write this week's check-in
          </Button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon="note"
            title="No check-ins yet"
            message="Two minutes on a Sunday buys you a programme that actually adapts."
          />
        ) : (
          <div>
            <SectionHeader title="History" />
            <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sorted.map((entry) => (
                <div key={entry.id} className="card" style={{ margin: 0, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span className="t-headline">{relativeDay(entry.date)}</span>
                    {/* Older entries already read as a date — don't print it twice. */}
                    {!formatMediumDate(entry.date).endsWith(relativeDay(entry.date)) && (
                      <span className="t-footnote dim">{formatMediumDate(entry.date)}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                    <Pill tone="tinted">{num(entry.weight, 1)} {profile.units}</Pill>
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

                  {entry.coachReply && (
                    <div
                      style={{
                        display: 'flex', gap: 10, marginTop: 12, padding: 12,
                        borderRadius: 12, background: 'var(--accent-soft)',
                      }}
                    >
                      <CoachAvatar size={26} />
                      <div style={{ minWidth: 0 }}>
                        <div className="t-caption1 semibold" style={{ color: 'var(--accent)' }}>Jud replied</div>
                        <div className="t-subhead" style={{ lineHeight: '20px', marginTop: 1 }}>
                          {entry.coachReply}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ComposeSheet
        open={composing}
        onClose={() => setComposing(false)}
        defaultWeight={trend?.current ?? profile.startWeight}
        onSubmit={(entry) => {
          addCheckIn(entry)
          haptic('success')
          toast('Sent to Jud', { icon: 'envelope', tone: 'good' })
        }}
      />
    </Screen>
  )
}

function ComposeSheet({
  open, onClose, defaultWeight, onSubmit,
}: {
  open: boolean
  onClose: () => void
  defaultWeight: number
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Weekly check-in"
      left={{ label: 'Cancel', onPress: onClose }}
      right={{
        label: 'Send',
        strong: true,
        onPress: () => {
          onSubmit({
            date: todayISO(),
            weight: Math.round(defaultWeight * 10) / 10,
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
        <div className="t-footnote dim" style={{ marginBottom: 16 }}>
          Your 7-day average ({num(defaultWeight, 1)}) goes with it automatically.
        </div>

        {SCALES.map((scale) => (
          <div key={scale.key} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span className="t-subhead semibold">{scale.label}</span>
              <span className="t-footnote dim">
                {values[scale.key] <= 2 ? scale.low : values[scale.key] >= 4 ? scale.high : 'Middling'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${scale.label} ${n} of 5`}
                  onClick={() => {
                    haptic('selection')
                    setValues((v) => ({ ...v, [scale.key]: n }))
                  }}
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 11,
                    background: values[scale.key] === n ? 'var(--accent)' : 'var(--fill-4)',
                    color: values[scale.key] === n ? '#fff' : 'var(--label)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span className="t-subhead semibold">Nutrition adherence</span>
            <span className="t-footnote mono-nums dim">{adherence}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={adherence}
            onChange={(e) => setAdherence(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
            aria-label="Nutrition adherence percentage"
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
            width: '100%', padding: '11px 13px', borderRadius: 12,
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
  )
}
