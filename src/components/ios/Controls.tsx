import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { haptic } from '../../lib/haptics'
import { readsAsFigure } from '../../lib/format'

/* ---------------------------- segmented control ------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: CSSProperties
  /** Names the control for assistive tech, as Switch already does. */
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  // Measure after layout so the pill never animates from a wrong first frame.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const buttons = el.querySelectorAll<HTMLElement>('.segment')
      const target = buttons[index]
      if (!target) return
      setThumb({ left: target.offsetLeft, width: target.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [index, options.length])

  /* One of these, not several: picking a segment is choosing between options,
     which `aria-pressed` cannot say — it reports each segment as separately
     on or off, and a reader hears no "1 of 4" and no sense that the others are
     the alternatives. A radio group says all of it.

     Which also fixes the keyboard: a group of buttons costs one Tab per option
     and gives the arrow keys nothing to do. A radio group is one stop, and the
     arrows move the choice — which is how UIKit's own control behaves, and how
     anyone who has used a segmented control anywhere expects it to. */
  const move = (delta: number) => {
    const next = options[(index + delta + options.length) % options.length]
    if (!next || next.value === value) return
    haptic('selection')
    onChange(next.value)
    // Focus follows selection, as it must in a roving-tabindex group.
    requestAnimationFrame(() => {
      ref.current?.querySelectorAll<HTMLElement>('.segment')[options.indexOf(next)]?.focus()
    })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (step) {
      e.preventDefault()
      move(step)
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      move((e.key === 'Home' ? 0 : options.length - 1) - index)
    }
  }

  return (
    <div className="segmented" ref={ref} style={style} role="radiogroup" aria-label={label}>
      {thumb && (
        <motion.div
          className="segmented-thumb"
          initial={false}
          animate={{ x: thumb.left, width: thumb.width }}
          transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }}
          style={{ left: 0 }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          // `index` falls back to the first option, so a control whose value
          // matches nothing is still reachable rather than skipped entirely.
          tabIndex={options.indexOf(o) === index ? 0 : -1}
          className="segment"
          data-active={o.value === value}
          onKeyDown={onKeyDown}
          onClick={() => {
            if (o.value !== value) haptic('selection')
            onChange(o.value)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------- switch -------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      data-on={checked}
      onClick={() => {
        haptic('light')
        onChange(!checked)
      }}
    >
      <span className="switch-knob" />
    </button>
  )
}

/* ------------------------------- stepper -------------------------------- */

export function Stepper({
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format,
  label,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  format?: (v: number) => string
  /** What is being stepped, so the two halves are not just "Decrease". */
  label?: string
}) {
  const held = useRef<number | null>(null)
  const repeated = useRef(false)
  // The ramp has to count from where it has got to, not from the value it was
  // started on — a held button used to fire the same step over and over.
  const latest = useRef(value)
  latest.current = value

  // Press-and-hold ramps up, like the UIKit stepper.
  const startRepeat = (delta: number) => {
    let speed = 420
    const tick = () => {
      repeated.current = true
      latest.current = clamp(latest.current + delta, min, max)
      onChange(latest.current)
      speed = Math.max(60, speed * 0.82)
      held.current = window.setTimeout(tick, speed)
    }
    held.current = window.setTimeout(tick, 480)
  }
  const stopRepeat = () => {
    if (held.current) window.clearTimeout(held.current)
    held.current = null
  }
  useEffect(() => stopRepeat, [])

  const bump = (delta: number) => {
    // The click that ends a hold is the release of a gesture that has already
    // counted, not another step.
    if (repeated.current) {
      repeated.current = false
      return
    }
    haptic('selection')
    onChange(clamp(value + delta, min, max))
  }

  /* UIStepper is one accessibility element that announces its value every time
     it changes. Two anonymous buttons and a span that nothing points at are not
     that: a reader heard "Decrease, button", pressed it, and was told nothing
     about what had happened or to what. */
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      role="group"
      aria-label={label}
    >
      {format && (
        <span
          className="t-body data"
          style={{ minWidth: 62, textAlign: 'right' }}
          // Polite and atomic: a held button ramps to sixty steps a second, and
          // what the client needs is the number it came to rest on, once.
          aria-live="polite"
          aria-atomic="true"
        >
          {format(value)}
        </span>
      )}
      {/* No `overflow: hidden` here: it would clip the pseudo-element that
          grows each half to a 44pt target, so the halves round their own outer
          corners instead. */}
      <div
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          background: 'var(--fill-3)',
          borderRadius: 'var(--r-chip)',
        }}
      >
        <button
          type="button"
          className="hit-expand"
          aria-label={label ? `Decrease ${label}` : 'Decrease'}
          disabled={value <= min}
          onClick={() => bump(-step)}
          onPointerDown={() => startRepeat(-step)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          style={{ ...stepperBtn, borderRadius: 'var(--r-chip) 0 0 var(--r-chip)' }}
        >
          <Icon name="minus" size={17} weight={2.4} />
        </button>
        <span style={{ width: 'var(--hairline)', background: 'var(--sep)' }} />
        <button
          type="button"
          className="hit-expand"
          aria-label={label ? `Increase ${label}` : 'Increase'}
          disabled={value >= max}
          onClick={() => bump(step)}
          onPointerDown={() => startRepeat(step)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          style={{ ...stepperBtn, borderRadius: '0 var(--r-chip) var(--r-chip) 0' }}
        >
          <Icon name="plus" size={17} weight={2.4} />
        </button>
      </div>
    </div>
  )
}

const stepperBtn: CSSProperties = {
  width: 46,
  height: 32,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--label)',
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/* -------------------------------- button -------------------------------- */

export type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'destructive' | 'plain'

export function Button({
  children,
  onPress,
  variant = 'filled',
  icon,
  disabled,
  small,
  pill,
  style,
  type = 'button',
}: {
  children: ReactNode
  onPress?: () => void
  variant?: ButtonVariant
  icon?: IconName
  disabled?: boolean
  small?: boolean
  pill?: boolean
  style?: CSSProperties
  type?: 'button' | 'submit'
}) {
  return (
    // No haptic here. iOS does not buzz for a tap, only for what the tap turned
    // out to mean, and the commits in this app already fire their own — this
    // rang a second time under every one of them.
    <button
      type={type}
      className={`btn btn-${variant}${small ? ' btn-sm' : ''}${pill ? ' btn-pill' : ''}`}
      onClick={onPress}
      disabled={disabled}
      style={style}
    >
      {icon && <Icon name={icon} size={small ? 16 : 19} weight={2.1} />}
      {children}
    </button>
  )
}

/* --------------------------------- pill --------------------------------- */

/** The first leaf of a node, which is where a pill's number would be. */
const leading = (node: ReactNode): unknown => (Array.isArray(node) ? leading(node[0]) : node)

export function Pill({
  children,
  tone = 'default',
  icon,
  style,
}: {
  children: ReactNode
  tone?: 'default' | 'tinted' | 'good' | 'warn' | 'bad'
  icon?: IconName
  style?: CSSProperties
}) {
  // "+0.4 lb/wk" and "8 weeks" are figures and take the data face; "Deload" and
  // "Main lift" are words and stay in SF. Nothing at the call site has to say so.
  const cls = [
    'pill',
    tone === 'default' ? '' : tone,
    readsAsFigure(leading(children)) ? 'data' : '',
  ].filter(Boolean).join(' ')
  return (
    <span className={cls} style={style}>
      {icon && <Icon name={icon} size={11} weight={2.6} />}
      {children}
    </span>
  )
}
