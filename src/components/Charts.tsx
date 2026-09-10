import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useSize } from '../lib/useSize'

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

export interface LineChartProps {
  data: Point[]
  /** Drawn under the main line — the rolling average, usually. */
  secondary?: Point[]
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

export function LineChart({
  data,
  secondary,
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

  const PAD_L = 8
  const PAD_R = 8
  const PAD_T = 14
  const PAD_B = 22

  const geom = useMemo(() => {
    if (!width || data.length === 0) return null
    const all = [...data.map((d) => d.y), ...(secondary?.map((d) => d.y) ?? [])]
    let min = Math.min(...all)
    let max = Math.max(...all)
    const dataSpan = max - min || Math.max(1, Math.abs(max) * 0.05)

    // A goal far outside the data would squash the whole trend into a corner,
    // so it only joins the scale when it is close enough to be worth showing.
    const goalInScale =
      goal != null && goal.value >= min - dataSpan * 0.6 && goal.value <= max + dataSpan * 0.6
    if (goalInScale) {
      min = Math.min(min, goal!.value)
      max = Math.max(max, goal!.value)
    }

    const span = max - min || Math.max(1, Math.abs(max) * 0.05)
    min -= span * padFraction
    max += span * padFraction

    const innerW = Math.max(1, width - PAD_L - PAD_R)
    const innerH = Math.max(1, height - PAD_T - PAD_B)
    const sx = (i: number, n: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const sy = (v: number) => PAD_T + innerH - ((v - min) / (max - min)) * innerH

    // Both series share the primary series' x positions so they stay aligned.
    const indexOf = new Map(data.map((d, i) => [d.x, i]))
    const primary = data.map((d, i) => ({ x: sx(i, data.length), y: sy(d.y), raw: d }))
    const trend = (secondary ?? [])
      .filter((d) => indexOf.has(d.x))
      .map((d) => ({ x: sx(indexOf.get(d.x)!, data.length), y: sy(d.y), raw: d }))

    return { primary, trend, sy, min, max, innerH, goalInScale }
  }, [width, data, secondary, goal, height, padFraction])

  const active = hover != null && geom ? geom.primary[hover] : null
  const activeTrend = hover != null && geom ? geom.trend[hover] : null

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

  return (
    <div ref={ref} style={{ width: '100%', ...style }}>
      {width > 0 && geom && (
        <svg
          width={width}
          height={height}
          style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {goal && geom.goalInScale && (
            <>
              <line
                x1={PAD_L} x2={width - PAD_R}
                y1={geom.sy(goal.value)} y2={geom.sy(goal.value)}
                stroke={goal.color ?? 'var(--label-3)'}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              {goal.label && (
                <text
                  x={width - PAD_R} y={geom.sy(goal.value) - 5}
                  textAnchor="end" fontSize="10" fontWeight="600"
                  fill={goal.color ?? 'var(--label-3)'}
                >
                  {goal.label}
                </text>
              )}
            </>
          )}

          {/* raw series */}
          {rawAsDots ? (
            geom.primary.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.9} fill={color} opacity={0.32} />
            ))
          ) : (
            <>
              <path
                d={`${smoothPath(geom.primary)}L${geom.primary[geom.primary.length - 1]!.x},${height - PAD_B}L${geom.primary[0]!.x},${height - PAD_B}Z`}
                fill={`url(#${gradientId})`}
              />
              <path
                d={smoothPath(geom.primary)}
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

          {/* scrubber */}
          {active && (
            <>
              <line
                x1={active.x} x2={active.x} y1={PAD_T - 6} y2={height - PAD_B}
                stroke="var(--label-3)" strokeWidth={1}
              />
              <circle
                cx={active.x} cy={(activeTrend ?? active).y} r={5}
                fill={secondaryColor ?? color} stroke="var(--grouped-2)" strokeWidth={2.5}
              />
              <text
                x={Math.min(Math.max(active.x, 28), width - 28)}
                y={PAD_T - 2}
                textAnchor="middle" fontSize="11" fontWeight="700"
                fill="var(--label)"
              >
                {formatValue((activeTrend ?? active).raw.y)}
              </text>
            </>
          )}

          {/* x labels: first and last only, iOS-sparse */}
          {formatLabel && geom.primary.length > 1 && (
            <>
              <text x={PAD_L} y={height - 6} fontSize="11" fill="var(--label-3)">
                {formatLabel(data[0]!.x)}
              </text>
              <text x={width - PAD_R} y={height - 6} fontSize="11" textAnchor="end" fill="var(--label-3)">
                {formatLabel(data[data.length - 1]!.x)}
              </text>
            </>
          )}
        </svg>
      )}
    </div>
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

/* ----------------------------- chart framing ---------------------------- */

export function ChartCard({
  title,
  value,
  caption,
  accessory,
  children,
}: {
  title: ReactNode
  value?: ReactNode
  caption?: ReactNode
  accessory?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="t-footnote dim">{title}</div>
          {value != null && (
            <div className="t-title2 mono-nums" style={{ marginTop: 1 }}>
              {value}
            </div>
          )}
          {caption && <div className="t-footnote dim" style={{ marginTop: 2 }}>{caption}</div>}
        </div>
        {accessory}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}
