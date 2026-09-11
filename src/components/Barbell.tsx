import { motion } from 'framer-motion'
import type { Profile } from '../domain/types'
import { groupPlates, solvePlates } from '../domain/strength'
import { num } from '../lib/format'

/* ============================================================================
   Loaded-bar diagram.

   conform-allow-file: the colours in here are objects, not theme values. A blue
   45 is blue on a chalk ground and blue on an iron one, steel is steel in both,
   and the light along a plate's rim is light. A bar that inverted with the
   theme would stop reading as a bar in either.

   Shows one sleeve, drawn to scale: plate height tracks real plate diameter and
   width tracks real thickness, so a stack reads at a glance the way it does on
   the floor. Colours follow the calibrated-plate convention lifters already
   know.

   The plates butt against each other, as they do on a bar, and are separated by
   a seam rather than by air — a gap between them turned a loaded barbell into a
   bar chart. Everything else here is the two details that make a drawing of a
   bar look like a bar: the knurl on the shaft, and the light sitting along the
   top edge of a disc.
   ========================================================================== */

interface PlateStyle {
  /** Fraction of the tallest plate's height. */
  height: number
  /** Drawn width in px. */
  width: number
  fill: string
}

const LB_PLATES: Record<number, PlateStyle> = {
  45: { height: 1, width: 17, fill: '#1d5fb0' },
  35: { height: 0.88, width: 15, fill: '#cf9a00' },
  25: { height: 0.76, width: 13, fill: '#1c8b4c' },
  10: { height: 0.58, width: 10, fill: '#6f6f77' },
  5: { height: 0.46, width: 8.5, fill: '#55555c' },
  2.5: { height: 0.36, width: 7, fill: '#3a3a40' },
}

const KG_PLATES: Record<number, PlateStyle> = {
  25: { height: 1, width: 17, fill: '#c22f27' },
  20: { height: 1, width: 16, fill: '#1d5fb0' },
  15: { height: 0.94, width: 13, fill: '#cf9a00' },
  10: { height: 0.88, width: 11, fill: '#1c8b4c' },
  5: { height: 0.66, width: 9, fill: '#cfcfd4' },
  2.5: { height: 0.52, width: 7.5, fill: '#6f6f77' },
  1.25: { height: 0.42, width: 6.5, fill: '#3a3a40' },
}

const FALLBACK: PlateStyle = { height: 0.4, width: 7, fill: '#6f6f77' }

/* The bar itself. Fixed values rather than label colours: a barbell is the same
   steel on a chalk ground as it is on an iron one, and one that inverted with
   the theme stopped reading as metal in either. */
const STEEL = '#a2a2a8'
const STEEL_DARK = '#76767e'
const KNURL = 'rgba(0, 0, 0, 0.22)'

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

  const SHAFT = 20
  const COLLAR = 7
  const CLIP = 6
  const SLEEVE_END = 9
  const plates = stack.perSide.map((plate) => styles[plate] ?? FALLBACK)
  const stackWidth = plates.reduce((w, p) => w + p.width, 0)
  const width = SHAFT + COLLAR + stackWidth + CLIP + SLEEVE_END
  const mid = height / 2
  const shaftH = Math.max(5, Math.round(height * 0.13))
  const sleeveH = shaftH + 4
  const platesX = SHAFT + COLLAR

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
        {/* Shaft, knurled where the hands go, running out of frame to the left
            because the other half of the bar is the same as this one. Steel is
            steel in both themes, so the bar does not take a label colour and
            invert itself between them. */}
        <rect x={-2} y={mid - shaftH / 2} width={SHAFT + 4} height={shaftH} rx={1} fill={STEEL} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={3 + i * 4} y={mid - shaftH / 2} width={1.2} height={shaftH} fill={KNURL} />
        ))}
        {/* The sleeve is one continuous piece the plates sit on, so it is drawn
            as one and passes behind them rather than stopping at each. */}
        <rect x={SHAFT} y={mid - sleeveH / 2} width={width - SHAFT} height={sleeveH} rx={1.5} fill={STEEL} />
        {/* Inside collar: the flange the first plate actually rests against. */}
        <rect x={SHAFT} y={mid - sleeveH / 2 - 2.5} width={COLLAR} height={sleeveH + 5} rx={1.5} fill={STEEL_DARK} />

        {plates.map((style, i) => {
          const x = platesX + plates.slice(0, i).reduce((w, p) => w + p.width, 0)
          const h = Math.max(13, height * style.height)
          const y = mid - h / 2
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.035, type: 'spring', stiffness: 520, damping: 34 }}
            >
              <rect x={x} y={y} width={style.width} height={h} rx={2} fill={style.fill} />
              {/* A disc catches the light along its top edge and loses it along
                  the bottom. Flat strokes, because a gradient here would be the
                  only one in the app. */}
              <rect x={x + 1.6} y={y + 1} width={style.width - 3.2} height={1.4} rx={0.7} fill="rgba(255,255,255,0.32)" />
              <rect x={x + 1.6} y={y + h - 2.4} width={style.width - 3.2} height={1.4} rx={0.7} fill="rgba(0,0,0,0.24)" />
              {/* Where one plate meets the next: the shadow in the joint and the
                  bevelled rim catching light on the near side of it. Without
                  this a stack of 45s is one blue slab rather than three plates. */}
              <rect x={x} y={y + 1} width={1.4} height={h - 2} fill="rgba(0,0,0,0.34)" />
              <rect x={x + 1.4} y={y + 1} width={1} height={h - 2} fill="rgba(255,255,255,0.16)" />
            </motion.g>
          )
        })}

        {/* Clip holding the stack on. The sleeve already runs past it. */}
        {!stack.barOnly && (
          <rect
            x={platesX + stackWidth}
            y={mid - sleeveH / 2 - 1.5}
            width={CLIP}
            height={sleeveH + 3}
            rx={1.5}
            fill={STEEL_DARK}
          />
        )}
      </svg>

      <div style={{ minWidth: 0, flex: 1 }}>
        {showTotal && <div className="eyebrow">Per side</div>}
        {stack.barOnly ? (
          <div className="t-subhead semibold truncate" style={{ marginTop: 2 }}>
            Empty bar
            <span className="data dim" style={{ fontWeight: 500 }}> · {num(profile.barWeight, 1)} {profile.units}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 2 }}>
            {groups.map((g, i) => (
              <span key={i} className="data" style={{ fontSize: 16 }}>
                {g.count}
                <span className="dim" style={{ fontWeight: 500 }}>×</span>
                {num(g.plate, 2)}
              </span>
            ))}
          </div>
        )}
        {Math.abs(stack.remainder) > 0.01 && (
          <div className="t-caption1" style={{ color: 'var(--orange-text)', marginTop: 2 }}>
            {stack.remainder > 0
              ? `${num(stack.remainder, 2)} short — loads to ${num(stack.achievable, 1)}`
              : `${num(-stack.remainder, 2)} over — loads to ${num(stack.achievable, 1)}`}
          </div>
        )}
      </div>
    </div>
  )
}
