import { useEffect, useState } from 'react'
import { Sheet } from './ios/Sheet'
import { Icon } from './Icon'
import { haptic } from '../lib/haptics'
import { num } from '../lib/format'

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
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open) {
      setText(initial > 0 ? num(initial, 2) : '')
      setDirty(false)
    }
  }, [open, initial])

  const value = Number(text || '0')
  const display = text === '' ? num(initial, 2) : text

  const press = (key: string) => {
    haptic('selection')
    setDirty(true)
    setText((prev) => {
      const base = dirty ? prev : ''
      if (key === 'del') return base.slice(0, -1)
      if (key === '.') {
        if (!allowDecimal || base.includes('.')) return base
        return base === '' ? '0.' : `${base}.`
      }
      const next = base + key
      if (next.replace('.', '').length > 6) return base
      if (max != null && Number(next) > max) return base
      return next
    })
  }

  const bump = (delta: number) => {
    haptic('light')
    const base = dirty ? value : initial
    const next = Math.max(0, Math.round((base + delta) * 100) / 100)
    setDirty(true)
    setText(num(next, 2))
  }

  const submit = () => {
    onSubmit(dirty ? value : initial)
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
          <span
            className="mono-nums"
            style={{ fontSize: 56, lineHeight: '68px', fontWeight: 700, letterSpacing: -1.4 }}
          >
            {display === '' ? '0' : display}
          </span>
          {unit && <span className="t-title3 dim">{unit}</span>}
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
                className="pill"
                style={{
                  fontSize: 15,
                  padding: '8px 14px',
                  background: 'var(--fill-3)',
                  color: 'var(--label)',
                  fontVariantNumeric: 'tabular-nums',
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
              style={{
                height: 56,
                borderRadius: 12,
                background: k === 'del' ? 'transparent' : 'var(--fill-4)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 26,
                fontWeight: 400,
                fontVariantNumeric: 'tabular-nums',
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

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

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
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {RPE_VALUES.map((v) => {
          const selected = value === v
          const isTarget = target === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                haptic('selection')
                onChange(v)
              }}
              style={{
                flex: '1 0 auto',
                minWidth: 52,
                padding: '9px 4px 7px',
                borderRadius: 11,
                background: selected ? 'var(--accent)' : 'var(--fill-4)',
                color: selected ? '#fff' : 'var(--label)',
                border: isTarget && !selected ? '1.5px dashed var(--accent)' : '1.5px solid transparent',
                transition: 'background 140ms ease, color 140ms ease',
              }}
            >
              <div className="mono-nums" style={{ fontSize: 17, fontWeight: 600, lineHeight: '20px' }}>
                {v}
              </div>
              {showRir && (
                <div
                  className="mono-nums"
                  style={{ fontSize: 10, lineHeight: '13px', opacity: selected ? 0.75 : 0.5 }}
                >
                  {num(10 - v, 1)} RIR
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
