import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import type { LoggedSet, SetPrescription } from '../../domain/types'
import { describeReps, formatRir, formatRpe, rpeToRir } from '../../domain/strength'
import type { ResolvedSet } from '../../domain/strength'
import { num } from '../../lib/format'
import { relativeDay } from '../../lib/date'

/* ------------------------------ layout rhythm ---------------------------- */

/**
 * Screens here set their group rhythm with a flex `gap` on the column wrapper.
 * A `.list-section` also carries its own 32px bottom margin, which would add to
 * that gap and leave inset lists sitting further apart than every other group.
 * Spread this on a `ListSection` so the wrapper's gap stays the only spacing.
 */
export const flushSection: CSSProperties = { marginBottom: 0 }

/* --------------------------- prescription display ------------------------ */

/** "5 reps · 330 lb" plus the intensity pills a percentage programme lives on. */
export function TargetSummary({
  resolved,
  units,
  showRir,
  size = 'md',
}: {
  resolved: ResolvedSet
  units: string
  showRir: boolean
  size?: 'sm' | 'md'
}) {
  const { prescription, targetWeight, percent, rpe } = resolved
  const big = size === 'md'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        className="mono-nums"
        style={{ fontSize: big ? 17 : 15, fontWeight: 600, letterSpacing: -0.3 }}
      >
        {describeReps(prescription)}
        <span className="dim" style={{ fontWeight: 400 }}> reps</span>
        {targetWeight != null && (
          <>
            <span className="dim" style={{ fontWeight: 400 }}> · </span>
            {num(targetWeight, 1)}
            <span className="dim" style={{ fontWeight: 400 }}> {units}</span>
          </>
        )}
      </span>
      {percent != null && prescription.load.kind === 'percent' && (
        <Pill tone="tinted">{num(percent, 1)}%</Pill>
      )}
      {prescription.load.kind === 'backoff' && <Pill>{prescription.load.pctOfTop}% of top</Pill>}
      {prescription.load.kind === 'rpe' && targetWeight == null && <Pill>Work up</Pill>}
      {rpe != null && (
        <Pill tone={rpe >= 9 ? 'warn' : 'default'}>
          {formatRpe(rpe)}
          {showRir && ` · ${formatRir(rpeToRir(rpe))}`}
        </Pill>
      )}
      {prescription.amrap && <Pill tone="warn" icon="flame.fill">AMRAP</Pill>}
      {prescription.tempo && <Pill>Tempo {prescription.tempo}</Pill>}
    </div>
  )
}

/* ------------------------------- history bits --------------------------- */

export function LastTimeLine({
  performance,
  units,
}: {
  performance?: { date: string; sets: LoggedSet[] }
  units: string
}) {
  if (!performance || performance.sets.length === 0) {
    return <span className="t-footnote dim">No history yet — this is set one.</span>
  }
  const best = performance.sets.reduce((b, s) => (s.weight > b.weight ? s : b))
  // One continuous text run — as flex items the date used to wrap onto its own
  // line with a gap in front of it. It truncates rather than wraps because the
  // one thing worse than a long line here is a line whose second row is "ago".
  return (
    <span className="t-footnote dim mono-nums truncate" style={{ display: 'block' }}>
      <Icon
        name="clock"
        size={12}
        weight={2.2}
        color="var(--label-3)"
        style={{ display: 'inline-block', verticalAlign: -1, marginRight: 5 }}
      />
      {/* A bodyweight lift logs a load of zero, and "Last 0 lb × 12" reads like
          a bug rather than like twelve hanging leg raises. */}
      Last {best.weight > 0 ? `${num(best.weight, 1)} ${units} × ${best.reps}` : `${best.reps} reps`}
      {best.rpe != null ? ` @ ${formatRpe(best.rpe)}` : ''}
      <span className="dim"> · {relativeDay(performance.date)}</span>
    </span>
  )
}

/** A logged set rendered compactly: "330 × 4 @ 8". */
export function LoggedSetChip({
  set,
  units,
  isPr,
  onPress,
}: {
  set: LoggedSet
  units: string
  isPr?: boolean
  onPress?: () => void
}) {
  const Tag = onPress ? 'button' : 'span'
  return (
    <Tag
      onClick={onPress}
      type={onPress ? 'button' : undefined}
      className="set-chip"
      // The chip carries the effort in its own colour, so a session's shape is
      // readable by glancing down the page rather than by reading every number.
      data-rpe={set.rpe ?? undefined}
      data-pr={isPr ? 'true' : undefined}
    >
      {isPr && <Icon name="seal.fill" size={11} color="var(--rpe-10-text)" />}
      {/* A bodyweight set carries no load, and "0 lb × 12" reads as a fault. */}
      {set.weight > 0 && (
        <>
          {num(set.weight, 1)}
          <span className="set-chip-unit">{units} ×</span>
        </>
      )}
      {set.reps}
      {set.weight <= 0 && <span className="set-chip-unit">reps</span>}
      {set.rpe != null && <span className="set-chip-rpe">@{num(set.rpe, 1)}</span>}
    </Tag>
  )
}

/* ------------------------------ superset tag ---------------------------- */

export function SupersetTag({ group }: { group: string }) {
  return (
    <span
      className="t-caption2 semibold"
      style={{
        padding: '2px 6px',
        borderRadius: 5,
        background: 'var(--fill-3)',
        color: 'var(--label-2)',
        letterSpacing: 0.3,
      }}
    >
      SUPERSET {group}
    </span>
  )
}

export function BlockHeading({
  index,
  name,
  supersetGroup,
  right,
}: {
  index: number
  name: ReactNode
  supersetGroup?: string
  right?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span
        className="mono-nums t-caption1 semibold"
        style={{
          width: 22, height: 22, borderRadius: 6, flex: 'none',
          background: 'var(--fill-3)', color: 'var(--label-2)',
          display: 'grid', placeItems: 'center',
        }}
      >
        {index}
      </span>
      <span className="t-headline truncate" style={{ flex: 1, minWidth: 0 }}>{name}</span>
      {supersetGroup && <SupersetTag group={supersetGroup} />}
      {right}
    </div>
  )
}

/** Warm-up ramp, shown collapsed above the first working set. */
export function WarmupList({
  sets,
  units,
}: {
  sets: { weight: number; reps: number; label: string }[]
  units: string
}) {
  if (sets.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {sets.map((s, i) => (
        <span
          key={i}
          className="mono-nums"
          style={{
            padding: '4px 9px', borderRadius: 8, fontSize: 13,
            background: 'var(--fill-4)', color: 'var(--label-2)',
          }}
        >
          {num(s.weight, 1)}<span style={{ opacity: 0.6 }}> {units} × {s.reps}</span>
        </span>
      ))}
    </div>
  )
}

export function setLabel(set: SetPrescription, index: number): string {
  if (set.amrap) return `Set ${index + 1} · AMRAP`
  return `Set ${index + 1}`
}
