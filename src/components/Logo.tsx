/* ============================================================================
   GRIT identity.

   The mark is the same geometry the app icon is rendered from: a heavy
   geometric ring cut open on the upper right, closed by a flat spur, and
   sheared forward so the letter leans into the run.

   conform-allow-file: this file draws artwork, not interface. Every literal in
   it is a value from public/icon.svg — the icon a client sees on their Home
   Screen is one picture in both themes, and the tile in Settings has to be that
   same picture or it is a different logo.
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

/**
 * The mark on its dark tile — the same artwork as the home-screen icon, and the
 * only place in the app where a gradient is allowed, because it is a picture of
 * an object rather than a surface of the app.
 *
 * The values are public/icon.svg's, to the stop: iron ground, a GRIT-blue sheen
 * from the upper left and a violet one from the lower right. It carries no drop
 * shadow for the same reason a home-screen icon does not — the icon is flat on
 * the wallpaper; the rim is the icon's own edge.
 */
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
          'radial-gradient(95% 95% at 28% 16%, rgba(11,87,240,0.34) 0%, rgba(11,87,240,0) 100%),'
          + ' radial-gradient(80% 80% at 82% 102%, rgba(76,72,224,0.16) 0%, rgba(76,72,224,0) 100%),'
          + ' linear-gradient(180deg, #16161a 0%, #0b0b0c 100%)',
        boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.09)',
      }}
    >
      <GritMark size={size * 0.62} color="#fff" />
    </div>
  )
}

/**
 * The wordmark, set in the data face — DESIGN.md §1 lists it there with the
 * numerals, and it was the one thing on the list still coming out of SF, which
 * made it read as a heading that happened to say GRIT.
 *
 * Archivo at its widest and heaviest, with the letters drawn almost together:
 * four capitals of a name want to be one shape, not four. The tagline is an
 * eyebrow — same face, opened right out, so it sits under the word as a rule
 * rather than as a second line of type.
 */
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: size * 0.16,
      }}
    >
      <span
        className="figure"
        style={{
          fontSize: size,
          fontWeight: 800,
          fontStretch: '112%',
          letterSpacing: '-0.015em',
        }}
      >
        GRIT
      </span>
      {tagline && (
        <span
          className="eyebrow"
          style={{
            fontSize: Math.max(8, size * 0.235),
            lineHeight: 1.2,
            letterSpacing: `${Math.min(0.22, size * 0.006)}em`,
            whiteSpace: 'nowrap',
          }}
        >
          Fitness and Performance
        </span>
      )}
    </div>
  )
}
