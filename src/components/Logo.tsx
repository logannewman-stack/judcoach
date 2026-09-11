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
 * The mark on its tile — the same artwork as the home-screen icon, and the only
 * place in the app where a gradient does this much work, because it is a picture
 * of an object rather than a surface of the app.
 *
 * The values are public/icon.svg's, to the stop: GRIT blue at two lightnesses,
 * a white sheen from the upper left that gives the square its curve, and the far
 * side deepened at the lower right. It carries no drop shadow for the same
 * reason a home-screen icon does not — the icon is flat on the wallpaper; the
 * rim is the icon's own edge. `size * 0.8` is scripts/make-icons.mjs's MARK, and
 * the two have to stay in step or Settings shows a different logo to the one on
 * the Home Screen.
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
          'radial-gradient(88% 88% at 26% 13%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%),'
          + ' radial-gradient(82% 82% at 86% 106%, rgba(0,51,184,0.30) 0%, rgba(0,51,184,0) 100%),'
          + ' linear-gradient(180deg, #4aa3ff 0%, #0a5bf5 100%)',
        boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.22)',
      }}
    >
      <GritMark size={size * 0.8} color="#fff" />
    </div>
  )
}

/**
 * The wordmark. The rounded face at its heaviest, with the letters drawn almost
 * together: four capitals of a name want to be one shape, not four.
 *
 * The tagline is an eyebrow, so it follows the app's label face wherever that
 * lands. Its tracking is the wordmark's own rather than the eyebrow's: at the
 * eyebrow's own 0.12em the line ran half again past the mark and stopped reading
 * as a rule under it. Pulled in, it sits at roughly the width of the word at
 * every size the app asks for.
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
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        GRIT
      </span>
      {tagline && (
        <span
          className="eyebrow"
          style={{
            fontSize: Math.max(8, size * 0.22),
            lineHeight: 1.2,
            letterSpacing: `${Math.min(0.08, size * 0.002)}em`,
            whiteSpace: 'nowrap',
            // The name, not a column heading: the eyebrow's own grey is a step
            // too far back for the one line that says what the app is.
            color: 'var(--label-2)',
          }}
        >
          Fitness and Performance
        </span>
      )}
    </div>
  )
}
