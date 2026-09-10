import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSize } from '../lib/useSize'
import '../styles/charts.css'

/* ============================================================================
   Charts — hand-rolled SVG so the type, spacing and motion match the rest of
   the app instead of a library's defaults.
   ========================================================================== */

export interface Point {
  /** ISO date or any sortable label. */
  x: string
  y: number
}

const uidCounter = { n: 0 }
const nextId = () => `c${++uidCounter.n}`

/** Catmull-Rom → cubic bézier, so trend lines curve without overshooting. */
function smoothPath(pts: { x: number; y: number }[], tension = 0.5): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`
  let d = `M${pts[0]!.x},${pts[0]!.y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

/**
 * Share of the vertical space the data itself is guaranteed, whatever the goal.
 * Letting a far-off goal into the scale unbounded squashes the trend into a
 * band; dropping it hides the one number the client is working towards. So the
 * scale stretches towards it this far and no further.
 */
const MIN_DATA_SHARE = 0.66

/**
 * Content key for a series, for use as a memo dependency. Callers build `data`
 * and `secondary` inline on every render, so keying on the array itself never
 * hits — the numbers in it are what decide the geometry.
 */
function seriesKey(pts: Point[] | undefined): string {
  if (!pts || pts.length === 0) return ''
  let key = String(pts.length)
  for (const p of pts) key += `|${p.x}:${p.y}`
  return key
}

export interface LineChartProps {
  data: Point[]
  /** Drawn under the main line — the rolling average, usually. */
  secondary?: Point[]
  /** A dashed pace line the data is meant to be compared against. */
  reference?: Point[]
  height?: number
  color?: string
  secondaryColor?: string
  /** Dotted horizontal reference, e.g. a goal weight. */
  goal?: { value: number; label?: string; color?: string }
  formatValue?: (v: number) => string
  formatLabel?: (x: string) => string
  /** Pads the y-domain so the line never touches the frame. */
  padFraction?: number
  showDots?: boolean
  /** Emphasise the raw series as scattered dots and the trend as the line. */
  rawAsDots?: boolean
  style?: CSSProperties
  ariaLabel?: string
}

/* The drawing's margins. The top band is deliberately taller than the type it
   holds: the scrub readout lives there, clear of the plot, so nothing the
   finger asks for lands on top of the goal line. */
const PAD_L = 8
const PAD_R = 8
const PAD_T = 22
const PAD_B = 22

/** Width and height of the drawn goal arrow, in user units. */
const ARROW_W = 7
const ARROW_H = 7

export function LineChart({
  data,
  secondary,
  reference,
  height = 180,
  color = 'var(--accent)',
  secondaryColor,
  goal,
  formatValue = (v) => String(Math.round(v * 10) / 10),
  formatLabel,
  padFraction = 0.12,
  showDots = false,
  rawAsDots = false,
  style,
  ariaLabel,
}: LineChartProps) {
  const { ref, width } = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useMemo(nextId, [])

  // Keys, not the props themselves, so a parent re-render with unchanged numbers
  // reuses the geometry instead of rebuilding it.
  const dataKey = seriesKey(data)
  const trendKey = seriesKey(secondary)
  const paceKey = seriesKey(reference)
  const goalValue = goal?.value ?? null

  const geom = useMemo(() => {
    if (!width || data.length === 0) return null
    const all = [...data.map((d) => d.y), ...(secondary?.map((d) => d.y) ?? [])]
    let min = Math.min(...all)
    let max = Math.max(...all)
    // A flat or single-point series has no extent of its own to scale against.
    const extent = max - min || Math.max(1, Math.abs(max) * 0.05)

    // The room the scale may stretch, above and below, before the data drops
    // under MIN_DATA_SHARE of the plot. It is discounted by padFraction, which
    // is added to the stretched span below, so the share holds of the plot the
    // client actually sees. Everything that is not data — the pace line, the
    // goal — draws on this one budget rather than each taking a helping.
    const room = Math.max(0, extent / (MIN_DATA_SHARE * (1 + padFraction * 2)) - extent)
    const ceiling = max + room
    const floor = min - room

    // The pace line goes first: a client six weeks behind a fast target would
    // otherwise pull the scale until their own weight was a flat line, and the
    // chart's first job is still to show what they weigh.
    if (reference && reference.length > 0) {
      max = Math.max(max, Math.min(Math.max(...reference.map((d) => d.y)), ceiling))
      min = Math.min(min, Math.max(Math.min(...reference.map((d) => d.y)), floor))
    }

    let beyond: 'above' | 'below' | null = null
    if (goalValue != null) {
      if (goalValue > ceiling) {
        max = ceiling
        beyond = 'above'
      } else if (goalValue < floor) {
        min = floor
        beyond = 'below'
      } else {
        min = Math.min(min, goalValue)
        max = Math.max(max, goalValue)
      }
    }

    const span = max - min || Math.max(1, Math.abs(max) * 0.05)
    min -= span * padFraction
    max += span * padFraction

    const innerW = Math.max(1, width - PAD_L - PAD_R)
    const innerH = Math.max(1, height - PAD_T - PAD_B)
    const sx = (i: number, n: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const sy = (v: number) => PAD_T + innerH - ((v - min) / (max - min)) * innerH
    // A pace line the budget above could not fit rides the frame rather than
    // leaving the drawing: a line that vanishes reads as an app fault, a line
    // pinned to the top reads as "further than this chart goes", which is true.
    const syClamped = (v: number) => Math.min(Math.max(sy(v), PAD_T), height - PAD_B)

    // Every series shares the primary series' x positions so they stay aligned.
    const indexOf = new Map(data.map((d, i) => [d.x, i]))
    const place = (pts: Point[], scale: (v: number) => number) =>
      pts
        .filter((d) => indexOf.has(d.x))
        .map((d) => ({ x: sx(indexOf.get(d.x)!, data.length), y: scale(d.y), raw: d }))
    const primary = data.map((d, i) => ({ x: sx(i, data.length), y: sy(d.y), raw: d }))
    const trend = place(secondary ?? [], sy)
    const pace = place(reference ?? [], syClamped)

    const goalY =
      goalValue == null
        ? null
        : beyond === 'above'
          ? PAD_T
          : beyond === 'below'
            ? height - PAD_B
            : sy(goalValue)

    return { primary, trend, pace, goal: goalY == null ? null : { y: goalY, beyond } }
  }, [width, height, padFraction, dataKey, trendKey, paceKey, goalValue])

  const active = hover != null && geom ? geom.primary[hover] : null
  const activeTrend = hover != null && geom ? geom.trend[hover] : null

  const goalColor = goal?.color ?? 'var(--label-3)'

  // The value rides along even when the line is honestly placed: with no y axis
  // to read it off, a line marked only "Goal" is a line marked nothing. Off the
  // scale, an arrow says which way the real one lies — drawn, not set, because
  // an arrow glyph's ink runs past the advance width the layout reserves for
  // it, and a right-anchored one is then sliced by the edge of the drawing on
  // whichever font the device falls back to.
  const goalText = goal?.label == null ? null : `${goal.label} ${formatValue(goal.value)}`
  const goalArrow = geom?.goal?.beyond ?? null

  // x labels: first and last only, iOS-sparse. Resolved here so the body below
  // keys on the two strings rather than on a formatter rebuilt every render.
  const spanLabels =
    formatLabel && data.length > 1
      ? { first: formatLabel(data[0]!.x), last: formatLabel(data[data.length - 1]!.x) }
      : null

  // Only the scrubber follows the finger, so the series, its fill and the goal
  // line are built once per geometry change: a pointermove then reconciles a
  // couple of nodes instead of every dot in the chart.
  const body = useMemo(() => {
    if (!geom) return null
    const line = rawAsDots ? null : smoothPath(geom.primary)
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geom.goal && (
          <>
            <line
              x1={PAD_L} x2={width - PAD_R}
              y1={geom.goal.y} y2={geom.goal.y}
              stroke={goalColor}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            {goalText && (
              <GoalLabel
                text={goalText}
                arrow={goalArrow}
                right={width - PAD_R}
                lineY={geom.goal.y}
              />
            )}
          </>
        )}

        {/* the pace the plan puts them on, under everything they actually did */}
        {geom.pace.length > 1 && (
          <path
            d={smoothPath(geom.pace)}
            fill="none"
            stroke="var(--label-2)"
            strokeWidth={1.6}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        )}

        {/* raw series */}
        {rawAsDots ? (
          geom.primary.map((p, i) => (
            // Half of --label-2 lands on --label-3, which is what the legend's
            // "Daily" key is painted in: the cloud and its label match.
            <circle key={i} cx={p.x} cy={p.y} r={1.9} fill={color} opacity={0.5} />
          ))
        ) : (
          <>
            <path
              d={`${line}L${geom.primary[geom.primary.length - 1]!.x},${height - PAD_B}L${geom.primary[0]!.x},${height - PAD_B}Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={line!}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* trend series */}
        {geom.trend.length > 1 && (
          <path
            d={smoothPath(geom.trend)}
            fill="none"
            stroke={secondaryColor ?? color}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showDots &&
          !rawAsDots &&
          geom.primary.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={color} />)}

        {spanLabels && (
          <>
            <text x={PAD_L} y={height - 6} fontSize="11" fill="var(--label-2)">
              {spanLabels.first}
            </text>
            <text x={width - PAD_R} y={height - 6} fontSize="11" textAnchor="end" fill="var(--label-2)">
              {spanLabels.last}
            </text>
          </>
        )}
      </>
    )
  }, [
    geom, width, height, color, secondaryColor, gradientId, rawAsDots, showDots,
    goalColor, goalText, goalArrow, spanLabels?.first, spanLabels?.last,
  ])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geom || geom.primary.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    let best = 0
    let bestDist = Infinity
    geom.primary.forEach((p, i) => {
      const d = Math.abs(p.x - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  // A weight on its own answers half the question the finger asked: the other
  // half is which morning it was.
  const activeText = active
    ? [formatLabel?.(active.raw.x), formatValue((activeTrend ?? active).raw.y)]
      .filter(Boolean)
      .join(' · ')
    : ''
  // Enough room for the readout to stay inside the drawing without measuring it:
  // 11px semibold runs about 5.6px a character, and the clamp only has to be
  // generous, not exact.
  const readoutHalf = Math.min((activeText.length * 5.6) / 2 + 2, (width - PAD_L - PAD_R) / 2)

  return (
    <div ref={ref} style={{ width: '100%', ...style }}>
      {width > 0 && geom && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={ariaLabel}
        >
          {body}

          {/* scrubber */}
          {active && (
            <>
              <line
                x1={active.x} x2={active.x} y1={PAD_T - 4} y2={height - PAD_B}
                stroke="var(--label-3)" strokeWidth={1}
              />
              {activeTrend && (
                <circle
                  cx={active.x} cy={active.y} r={3}
                  fill={color} stroke="var(--grouped-2)" strokeWidth={1.5}
                />
              )}
              <circle
                cx={active.x} cy={(activeTrend ?? active).y} r={5}
                fill={secondaryColor ?? color} stroke="var(--grouped-2)" strokeWidth={2.5}
              />
              <text
                x={Math.min(Math.max(active.x, PAD_L + readoutHalf), width - PAD_R - readoutHalf)}
                y={PAD_T - 7}
                textAnchor="middle" fontSize="11" fontWeight="700"
                fill="var(--label)"
              >
                {activeText}
              </text>
            </>
          )}
        </svg>
      )}
    </div>
  )
}

/**
 * The goal's number, parked on its line. When the goal is off the scale the line
 * is drawn on the edge of the plot and the label carries an arrow for the
 * direction the real value lies in; the arrow is a path so its geometry is the
 * one we reserved room for, whatever font the text falls back to.
 */
function GoalLabel({
  text, arrow, right, lineY,
}: {
  text: string
  arrow: 'above' | 'below' | null
  right: number
  lineY: number
}) {
  // Off-scale lines sit on the frame, so the label hangs into the plot — which
  // MIN_DATA_SHARE keeps clear of data for exactly this. An in-scale line has
  // data on both sides, so the label rides above it and flips below only when
  // the line is high enough to push it into the scrub readout's band.
  const y =
    arrow === 'above' ? lineY + 15
    : arrow === 'below' ? lineY - 7
    : lineY - 6 < PAD_T + 9 ? lineY + 15
    : lineY - 6
  // Middle of a 10px cap height, so the arrow reads as part of the word.
  const mid = y - 3.5
  const top = mid - ARROW_H / 2
  const base = mid + ARROW_H / 2
  return (
    <>
      <text
        x={right - (arrow ? ARROW_W + 4 : 0)}
        y={y}
        textAnchor="end" fontSize="10" fontWeight="600"
        fill="var(--label-2)"
      >
        {text}
      </text>
      {arrow && (
        <path
          d={
            arrow === 'above'
              ? `M${right - ARROW_W / 2},${top}L${right},${base}L${right - ARROW_W},${base}Z`
              : `M${right - ARROW_W / 2},${base}L${right},${top}L${right - ARROW_W},${top}Z`
          }
          fill="var(--label-2)"
        />
      )}
    </>
  )
}

/* ------------------------------- bar chart ------------------------------ */

export interface Bar {
  label: string
  value: number
  color?: string
  /** Dotted marker for a target/minimum-effective-dose line. */
  target?: number
}

export function BarChart({
  bars,
  height = 150,
  color = 'var(--accent)',
  formatValue = (v: number) => String(Math.round(v)),
  showValues = true,
}: {
  bars: Bar[]
  height?: number
  color?: string
  formatValue?: (v: number) => string
  showValues?: boolean
}) {
  const { ref, width } = useSize<HTMLDivElement>()
  const max = Math.max(...bars.map((b) => Math.max(b.value, b.target ?? 0)), 1)
  const PAD_B = 20
  const PAD_T = showValues ? 16 : 6
  const innerH = height - PAD_B - PAD_T
  const gap = bars.length > 8 ? 4 : 8
  const barW = width > 0 ? Math.max(6, (width - gap * (bars.length - 1)) / bars.length) : 0

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: 'block' }}>
          {bars.map((b, i) => {
            const x = i * (barW + gap)
            const h = Math.max(2, (b.value / max) * innerH)
            const y = PAD_T + innerH - h
            return (
              <g key={b.label}>
                <rect
                  x={x} y={PAD_T} width={barW} height={innerH}
                  rx={Math.min(5, barW / 2)} fill="var(--fill-4)"
                />
                <rect
                  x={x} y={y} width={barW} height={h}
                  rx={Math.min(5, barW / 2)} fill={b.color ?? color}
                />
                {b.target != null && (
                  <line
                    x1={x - 1} x2={x + barW + 1}
                    y1={PAD_T + innerH - (b.target / max) * innerH}
                    y2={PAD_T + innerH - (b.target / max) * innerH}
                    stroke="var(--label-2)" strokeWidth={1.5} strokeDasharray="2 3"
                  />
                )}
                {showValues && (
                  <text
                    x={x + barW / 2} y={y - 5}
                    textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--label-2)"
                  >
                    {formatValue(b.value)}
                  </text>
                )}
                <text
                  x={x + barW / 2} y={height - 6}
                  textAnchor="middle" fontSize="10" fill="var(--label-3)"
                >
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/* ------------------------------- sparkline ------------------------------ */

export function Sparkline({
  values,
  width = 64,
  height = 24,
  color = 'var(--accent)',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * (width - 3) + 1.5,
    y: height - 2 - ((v - min) / span) * (height - 4),
  }))
  return (
    <svg width={width} height={height} style={{ display: 'block', flex: 'none' }} aria-hidden="true">
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}
