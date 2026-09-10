/* ============================================================================
   GRIT identity.

   The mark is the same geometry the app icon is rendered from: a heavy
   geometric ring cut open on the upper right, closed by a flat spur, and
   sheared forward so the letter leans into the run.
   ========================================================================== */

/* Geometry, in the 100×100 mark space. */
const R_MID = 27.8
const STROKE = 17.6
const R_OUTER = R_MID + STROKE / 2
const GAP_TO = 58 // degrees, anticlockwise from +x with y up
const LEAN = 9.09 // degrees of forward shear

const rad = (deg: number) => (deg * Math.PI) / 180
const at = (deg: number, r = R_MID) =>
  `${(50 + Math.cos(rad(deg)) * r).toFixed(2)} ${(50 - Math.sin(rad(deg)) * r).toFixed(2)}`

/** Opening starts exactly where the spur's top edge meets the outer radius. */
const GAP_FROM = (Math.asin(STROKE / 2 / R_OUTER) * 180) / Math.PI

export function GritMark({
  size = 44,
  color = 'currentColor',
  className,
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={{ display: 'block', flex: 'none' }}
      role="img"
      aria-label="GRIT"
    >
      <g transform={`translate(0 50) skewX(${-LEAN}) translate(0 -50)`}>
        <path
          d={`M ${at(GAP_TO)} A ${R_MID} ${R_MID} 0 1 0 ${at(GAP_FROM)}`}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
        />
        <rect x={50} y={50 - STROKE / 2} width={R_OUTER} height={STROKE} fill={color} />
      </g>
    </svg>
  )
}

/** The mark on its dark tile — matches the home-screen icon exactly. */
export function GritTile({ size = 56, radius }: { size?: number; radius?: number }) {
  const r = radius ?? size * 0.2237
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(120% 120% at 28% 16%, rgba(10,132,255,0.42) 0%, rgba(10,132,255,0) 62%),'
          + ' radial-gradient(90% 90% at 82% 102%, rgba(94,92,230,0.30) 0%, rgba(94,92,230,0) 60%),'
          + ' linear-gradient(180deg, #18181b 0%, #0b0b0d 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.28), inset 0 0 0 0.5px rgba(255,255,255,0.09)',
      }}
    >
      <GritMark size={size * 0.62} color="#fff" />
    </div>
  )
}

export function Wordmark({
  size = 28,
  tagline = true,
  align = 'left',
}: {
  size?: number
  tagline?: boolean
  align?: 'left' | 'center'
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: size * 0.1 }}>
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: size * 0.02,
          fontFamily: 'var(--font)',
        }}
      >
        GRIT
      </span>
      {tagline && (
        <span
          style={{
            fontSize: Math.max(8, size * 0.265),
            lineHeight: 1.2,
            fontWeight: 600,
            letterSpacing: Math.max(0.8, size * 0.085),
            textTransform: 'uppercase',
            color: 'var(--label-2)',
            whiteSpace: 'nowrap',
          }}
        >
          Fitness and Performance
        </span>
      )}
    </div>
  )
}
