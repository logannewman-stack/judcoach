import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { haptic } from '../../lib/haptics'

/* ---------------------------- segmented control ------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: CSSProperties
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

  return (
    <div className="segmented" ref={ref} style={style} role="tablist">
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
          role="tab"
          aria-selected={o.value === value}
          className="segment"
          data-active={o.value === value}
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
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  format?: (v: number) => string
}) {
  const held = useRef<number | null>(null)

  // Press-and-hold ramps up, like the UIKit stepper.
  const startRepeat = (delta: number) => {
    let speed = 420
    const tick = () => {
      onChange(clamp(value + delta, min, max))
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
    haptic('selection')
    onChange(clamp(value + delta, min, max))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {format && (
        <span className="t-body mono-nums semibold" style={{ minWidth: 62, textAlign: 'right' }}>
          {format(value)}
        </span>
      )}
      <div
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          background: 'var(--fill-3)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          aria-label="Decrease"
          disabled={value <= min}
          onClick={() => bump(-step)}
          onPointerDown={() => startRepeat(-step)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          style={stepperBtn}
        >
          <Icon name="minus" size={17} weight={2.4} />
        </button>
        <span style={{ width: 0.5, background: 'var(--sep)' }} />
        <button
          type="button"
          aria-label="Increase"
          disabled={value >= max}
          onClick={() => bump(step)}
          onPointerDown={() => startRepeat(step)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          style={stepperBtn}
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
    <button
      type={type}
      className={`btn btn-${variant}${small ? ' btn-sm' : ''}${pill ? ' btn-pill' : ''}`}
      onClick={
        onPress
          ? () => {
              haptic('medium')
              onPress()
            }
          : undefined
      }
      disabled={disabled}
      style={style}
    >
      {icon && <Icon name={icon} size={small ? 16 : 19} weight={2.1} />}
      {children}
    </button>
  )
}

/* --------------------------------- pill --------------------------------- */

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
  const cls = tone === 'default' ? 'pill' : `pill ${tone}`
  return (
    <span className={cls} style={style}>
      {icon && <Icon name={icon} size={11} weight={2.6} />}
      {children}
    </span>
  )
}
