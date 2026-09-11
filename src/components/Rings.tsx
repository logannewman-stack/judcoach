import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
// The macro hues live here, and Today draws these rings without ever loading
// the Meals screen's stylesheet.
import '../styles/fuel.css'

/* ============================================================================
   Progress rings.

   Three macros, three hues — tokens.css says why. The hue says *which* macro
   and nothing else, so no state ever repaints an arc: a ring that turned green
   on completion made protein, carbohydrate and fat one colour at exactly the
   moment a client was reading all three, and protein — already drawn in that
   green — could never show the change at all. A ring reports itself by closing,
   the way an Activity ring does. Only an overshoot takes a colour of its own,
   and the caller resolves that, because how much past a target still counts as
   hitting it is the Meals screen's rule and not this file's.
   ========================================================================== */

export interface RingSpec {
  value: number
  target: number
  color: string
  label?: string
}

const RING_SPRING = { type: 'spring' as const, stiffness: 90, damping: 18, mass: 1 }

export function ProgressRing({
  value,
  target,
  color = 'var(--accent)',
  size = 120,
  thickness = 12,
  track = 'var(--fuel-track)',
  children,
  delay = 0,
}: {
  value: number
  target: number
  color?: string
  size?: number
  thickness?: number
  track?: string
  children?: ReactNode
  delay?: number
}) {
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(value / target, 1) : 0

  return (
    <div style={{ width: size, height: size, position: 'relative', flex: 'none' }}>
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={track} strokeWidth={thickness}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ ...RING_SPRING, delay }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** Concentric rings — protein / carbs / fat, outermost first. */
export function RingStack({
  rings,
  size = 128,
  thickness = 11,
  gap = 4,
  children,
}: {
  rings: RingSpec[]
  size?: number
  thickness?: number
  gap?: number
  children?: ReactNode
}) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flex: 'none' }}>
      {rings.map((ring, i) => {
        const inset = i * (thickness + gap)
        return (
          <div key={i} style={{ position: 'absolute', top: inset, left: inset }}>
            <ProgressRing
              value={ring.value}
              target={ring.target}
              color={ring.color}
              size={size - inset * 2}
              thickness={thickness}
              delay={i * 0.07}
            />
          </div>
        )
      })}
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * A hue each, ordered the way the plan orders them: protein in the Meals
 * domain's own green because it is the number to protect, carbohydrate amber,
 * fat violet.
 *
 * Water is not a macro and no longer borrows one's colour. Drawn in
 * carbohydrate's amber it painted a droplet honey-coloured and gave the water
 * card a bar that differed from the carbs bar above it by one pixel of height
 * and nothing else, so the screen read as having four macros, one of which was
 * water. It takes the blue the thing itself is.
 */
export const MACRO_COLORS = {
  protein: 'var(--fuel-1)',
  carbs: 'var(--fuel-2)',
  fat: 'var(--fuel-3)',
  water: 'var(--cyan)',
} as const
