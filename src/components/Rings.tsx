import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/* ============================================================================
   Activity-style progress rings.
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
  track = 'var(--fill-3)',
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
          fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
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
              // Tint each track with its own macro so an empty day still reads
              // as protein / carbs / fat rather than three grey circles.
              track={`color-mix(in srgb, ${ring.color} 17%, transparent)`}
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

export const MACRO_COLORS = {
  kcal: 'var(--accent)',
  protein: 'var(--red)',
  carbs: 'var(--orange)',
  fat: 'var(--yellow)',
  water: 'var(--cyan)',
} as const
