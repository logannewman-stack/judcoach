import { motion } from 'framer-motion'
import type { Profile } from '../domain/types'
import { groupPlates, solvePlates } from '../domain/strength'
import { num } from '../lib/format'

/* ============================================================================
   Loaded-bar diagram.

   Shows one sleeve, drawn to scale: plate height tracks real plate diameter and
   width tracks real thickness, so a stack reads at a glance the way it does on
   the floor. Colours follow the calibrated-plate convention lifters already
   know.
   ========================================================================== */

interface PlateStyle {
  /** Fraction of the tallest plate's height. */
  height: number
  /** Drawn width in px. */
  width: number
  fill: string
  /** Text colour that survives on that fill. */
  ink: string
}

const LB_PLATES: Record<number, PlateStyle> = {
  45: { height: 1, width: 15, fill: '#1f6feb', ink: '#fff' },
  35: { height: 0.88, width: 13, fill: '#e8b400', ink: '#241c00' },
  25: { height: 0.76, width: 12, fill: '#1f9d55', ink: '#fff' },
  10: { height: 0.58, width: 9, fill: '#8e8e93', ink: '#fff' },
  5: { height: 0.46, width: 8, fill: '#5f5f66', ink: '#fff' },
  2.5: { height: 0.36, width: 7, fill: '#48484a', ink: '#fff' },
}

const KG_PLATES: Record<number, PlateStyle> = {
  25: { height: 1, width: 15, fill: '#d0342c', ink: '#fff' },
  20: { height: 1, width: 14, fill: '#1f6feb', ink: '#fff' },
  15: { height: 0.94, width: 12, fill: '#e8b400', ink: '#241c00' },
  10: { height: 0.88, width: 11, fill: '#1f9d55', ink: '#fff' },
  5: { height: 0.66, width: 9, fill: '#d8d8dc', ink: '#1c1c1e' },
  2.5: { height: 0.52, width: 8, fill: '#8e8e93', ink: '#fff' },
  1.25: { height: 0.42, width: 7, fill: '#5f5f66', ink: '#fff' },
}

const FALLBACK: PlateStyle = { height: 0.4, width: 7, fill: '#8e8e93', ink: '#fff' }

export function Barbell({
  target,
  profile,
  height = 62,
  showTotal = true,
}: {
  target: number
  profile: Pick<Profile, 'barWeight' | 'availablePlates' | 'units'>
  height?: number
  showTotal?: boolean
}) {
  const stack = solvePlates(target, profile.barWeight, profile.availablePlates)
  const groups = groupPlates(stack.perSide)
  const styles = profile.units === 'kg' ? KG_PLATES : LB_PLATES

  const SLEEVE_W = 26
  const GAP = 2
  const plates = stack.perSide.map((plate) => styles[plate] ?? FALLBACK)
  const stackWidth = plates.reduce((w, p) => w + p.width + GAP, 0)
  const width = SLEEVE_W + stackWidth + 14
  const mid = height / 2

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ flex: 'none', overflow: 'visible' }}
        role="img"
        aria-label={
          stack.barOnly
            ? `Empty bar, ${num(profile.barWeight, 1)} ${profile.units}`
            : `Per side: ${groups.map((g) => `${g.count} times ${g.plate}`).join(', ')}`
        }
      >
        {/* sleeve running out of the collar */}
        <rect x={0} y={mid - 4} width={SLEEVE_W + 6} height={8} rx={4} fill="var(--label-3)" />
        <rect x={SLEEVE_W - 4} y={mid - 7} width={5} height={14} rx={2} fill="var(--label-2)" />

        {plates.map((style, i) => {
          const x = SLEEVE_W + 2 + plates.slice(0, i).reduce((w, p) => w + p.width + GAP, 0)
          const h = Math.max(14, height * style.height)
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.035, type: 'spring', stiffness: 520, damping: 34 }}
            >
              <rect
                x={x}
                y={mid - h / 2}
                width={style.width}
                height={h}
                rx={Math.min(3.5, style.width / 2)}
                fill={style.fill}
              />
            </motion.g>
          )
        })}

        {/* collar clamp closing the stack */}
        {!stack.barOnly && (
          <rect
            x={SLEEVE_W + 2 + stackWidth}
            y={mid - 6}
            width={6}
            height={12}
            rx={2.5}
            fill="var(--label-2)"
          />
        )}
      </svg>

      <div style={{ minWidth: 0, flex: 1 }}>
        {showTotal && (
          <div className="t-caption1 dim semibold" style={{ letterSpacing: 0.3 }}>
            PER SIDE
          </div>
        )}
        {stack.barOnly ? (
          <div className="mono-nums truncate" style={{ fontSize: 15, fontWeight: 600, marginTop: 1 }}>
            Empty bar · {num(profile.barWeight, 1)} {profile.units}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 1 }}>
            {groups.map((g, i) => (
              <span
                key={i}
                className="mono-nums"
                style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}
              >
                {g.count}
                <span className="dim" style={{ fontWeight: 400 }}>×</span>
                {num(g.plate, 2)}
              </span>
            ))}
          </div>
        )}
        {Math.abs(stack.remainder) > 0.01 && (
          <div className="t-caption1" style={{ color: 'var(--orange)', marginTop: 2 }}>
            {stack.remainder > 0
              ? `${num(stack.remainder, 2)} short — loads to ${num(stack.achievable, 1)}`
              : `${num(-stack.remainder, 2)} over — loads to ${num(stack.achievable, 1)}`}
          </div>
        )}
      </div>
    </div>
  )
}
