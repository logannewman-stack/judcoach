import { useEffect, useState } from 'react'
import { Sheet } from './ios/Sheet'
import { Icon } from './Icon'
import { haptic } from '../lib/haptics'
import { num } from '../lib/format'
import { RPE_STEPS, formatRir } from '../domain/strength'

/* ============================================================================
   Numeric entry.

   A custom keypad rather than a native <input type="number"> — on a phone the
   system keyboard covers half the screen, mis-fires the zoom, and offers no
   plate-sized increments. This gives big targets and the ± steps a lifter
   actually reaches for mid-set.
   ========================================================================== */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

export function NumberPad({
  open,
  onClose,
  onSubmit,
  title,
  initial,
  unit,
  /** Quick ± chips, e.g. plate jumps. */
  steps = [],
  allowDecimal = true,
  max,
  hint,
  submitLabel = 'Done',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (value: number) => void
  title: string
  initial: number
  unit?: string
  steps?: number[]
  allowDecimal?: boolean
  max?: number
  hint?: string
  submitLabel?: string
}) {
  // Text and "has this been touched" are one piece of state because every key
  // needs both to decide what to do. Held apart, a press read the flag from the
  // render it was queued in, which is how a single backspace used to submit 0.
  const [entry, setEntry] = useState({ text: '', touched: false })
  const { text, touched } = entry

  useEffect(() => {
    if (open) setEntry({ text: initial > 0 ? num(initial, 2) : '', touched: false })
  }, [open, initial])

  const value = Number(text || '0')
  const display = !touched && text === '' ? num(initial, 2) : text

  const press = (key: string) => {
    haptic('selection')
    setEntry((prev) => {
      // The first digit replaces what the pad opened with — that is what typing
      // a fresh weight means. Backspace edits it instead: deleting is the one
      // key that can only mean what is on the screen.
      const base = prev.touched || key === 'del' ? prev.text : ''
      const keep = (next: string) => ({ text: next, touched: true })
      if (key === 'del') return keep(base.slice(0, -1))
      if (key === '.') {
        if (!allowDecimal || base.includes('.')) return keep(base)
        return keep(base === '' ? '0.' : `${base}.`)
      }
      const next = base + key
      if (next.replace('.', '').length > 6) return keep(base)
      if (max != null && Number(next) > max) return keep(base)
      return keep(next)
    })
  }

  const bump = (delta: number) => {
    haptic('light')
    setEntry((prev) => {
      const base = prev.touched ? Number(prev.text || '0') : initial
      const next = Math.max(0, Math.round((base + delta) * 100) / 100)
      return { text: num(next, 2), touched: true }
    })
  }

  const submit = () => {
    onSubmit(touched ? value : initial)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      left={{ label: 'Cancel', onPress: onClose }}
      right={{ label: submitLabel, onPress: submit, strong: true }}
      detent={0.78}
    >
      <div style={{ padding: '4px 16px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 6,
            minHeight: 72,
          }}
        >
          <span className="figure" style={{ fontSize: 58, lineHeight: '68px' }}>
            {display === '' ? '0' : display}
          </span>
          {unit && <span className="figure-unit" style={{ fontSize: 20 }}>{unit}</span>}
        </div>
        {hint && (
          <div className="t-footnote dim" style={{ textAlign: 'center', marginTop: -4, marginBottom: 4 }}>
            {hint}
          </div>
        )}

        {steps.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
              margin: '12px 0 4px',
            }}
          >
            {steps.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => bump(s)}
                className="pill data"
                style={{
                  fontSize: 15,
                  padding: '8px 14px',
                  background: 'var(--fill-3)',
                  color: 'var(--label)',
                }}
              >
                {s > 0 ? '+' : '−'}
                {num(Math.abs(s), 2)}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 9,
            marginTop: 14,
          }}
        >
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k}
              className="data"
              style={{
                height: 56,
                borderRadius: 'var(--r-btn)',
                background: k === 'del' ? 'transparent' : 'var(--fill-4)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 25,
                fontWeight: 500,
                color: 'var(--label)',
                opacity: k === '.' && !allowDecimal ? 0.3 : 1,
              }}
            >
              {k === 'del' ? <Icon name="chevron.left" size={24} weight={2.2} /> : k}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

/* ------------------------------- RPE picker ----------------------------- */

export const RPE_DESCRIPTIONS: Record<string, string> = {
  '10': 'Nothing left — could not add weight or reps',
  '9.5': 'Could add a little weight, not another rep',
  '9': 'One solid rep left',
  '8.5': 'One rep left, maybe two',
  '8': 'Two reps left',
  '7.5': 'Two reps left, maybe three',
  '7': 'Three reps left — bar speed still fast',
  '6.5': 'Three to four reps left',
  '6': 'Four or more reps left — warm-up territory',
}

export function RpePicker({
  value,
  onChange,
  showRir = true,
  target,
}: {
  value?: number
  onChange: (v: number) => void
  showRir?: boolean
  target?: number
}) {
  return (
    <div>
      <div
        style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}
      >
        {/* RPE is a scale from cool to hot, so the picker is that scale: every
            step wears its own place on the ramp rather than nine identical grey
            chips that only differ once one is chosen. The selection is the ring;
            the dashed one is what Jud asked for. */}
        {RPE_STEPS.map((v) => {
          const selected = value === v
          const isTarget = target === v
          return (
            <button
              key={v}
              type="button"
              data-rpe={v}
              onClick={() => {
                haptic('selection')
                onChange(v)
              }}
              style={{
                flex: '1 0 auto',
                minWidth: 52,
                padding: '9px 4px 7px',
                borderRadius: 'var(--r-chip)',
                background: selected
                  ? 'color-mix(in srgb, var(--rpe) 20%, transparent)'
                  : 'var(--rpe-fill)',
                color: 'var(--rpe)',
                border: selected
                  ? '2px solid var(--rpe)'
                  : isTarget
                    ? '2px dashed color-mix(in srgb, var(--rpe) 55%, transparent)'
                    : '2px solid transparent',
                transition: 'background 140ms ease, border-color 140ms ease',
              }}
            >
              <div
                className="data"
                style={{ fontSize: 17, fontWeight: selected ? 700 : 600, lineHeight: '20px' }}
              >
                {v}
              </div>
              {showRir && (
                <div className="data" style={{ fontSize: 10, lineHeight: '13px', opacity: 0.72 }}>
                  {formatRir(10 - v)}
                </div>
              )}
            </button>
          )
        })}
      </div>
      {value != null && (
        <div className="t-footnote dim" style={{ marginTop: 8, minHeight: 18 }}>
          {RPE_DESCRIPTIONS[String(value)]}
        </div>
      )}
    </div>
  )
}
