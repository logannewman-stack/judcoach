import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import type { LoggedSet, Profile, SetPrescription } from '../../domain/types'
import {
  describeReps, formatRpe, groupPlates, rpeToRir, solvePlates,
} from '../../domain/strength'
import type { ResolvedSet } from '../../domain/strength'
import { num } from '../../lib/format'
import { relativeDay } from '../../lib/date'

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
          {showRir && ` · ${num(rpeToRir(rpe), 1)} RIR`}
        </Pill>
      )}
      {prescription.amrap && <Pill tone="warn" icon="flame.fill">AMRAP</Pill>}
      {prescription.tempo && <Pill>Tempo {prescription.tempo}</Pill>}
    </div>
  )
}

/* ------------------------------ plate maths ----------------------------- */

const PLATE_COLORS: Record<number, string> = {
  45: 'var(--blue)', 35: 'var(--yellow)', 25: 'var(--green)',
  20: 'var(--blue)', 15: 'var(--yellow)', 10: 'var(--label-2)',
  5: 'var(--label-2)', 2.5: 'var(--label-3)', 1.25: 'var(--label-3)',
}

export function PlateRow({
  target,
  profile,
}: {
  target: number
  profile: Pick<Profile, 'barWeight' | 'availablePlates' | 'units'>
}) {
  const stack = solvePlates(target, profile.barWeight, profile.availablePlates)
  const groups = groupPlates(stack.perSide)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="t-caption1 dim semibold">Per side</span>
      {stack.barOnly ? (
        <span className="t-caption1 dim">Bar only ({num(profile.barWeight, 1)} {profile.units})</span>
      ) : (
        groups.map((g, i) => (
          <span
            key={i}
            className="mono-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '3px 8px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              background: PLATE_COLORS[g.plate] ?? 'var(--label-2)',
            }}
          >
            {g.count}<span style={{ opacity: 0.7 }}>×</span>{num(g.plate, 2)}
          </span>
        ))
      )}
      {Math.abs(stack.remainder) > 0.01 && (
        <span className="t-caption1" style={{ color: 'var(--orange)' }}>
          {stack.remainder > 0 ? `${num(stack.remainder, 2)} short` : `${num(-stack.remainder, 2)} over`}
          {' · '}load {num(stack.achievable, 1)}
        </span>
      )}
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
  return (
    <span className="t-footnote dim" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Icon name="clock" size={12} weight={2.2} color="var(--label-3)" />
      <span className="mono-nums">
        Last time {num(best.weight, 1)} {units} × {best.reps}
        {best.rpe != null ? ` @ ${formatRpe(best.rpe)}` : ''}
      </span>
      <span className="dim3">· {relativeDay(performance.date)}</span>
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
      className="mono-nums"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        background: isPr ? 'rgba(255,149,0,0.16)' : 'var(--fill-4)',
        color: isPr ? 'var(--orange)' : 'var(--label)',
      }}
    >
      {isPr && <Icon name="seal.fill" size={11} color="var(--orange)" />}
      {num(set.weight, 1)}
      <span className="dim" style={{ fontWeight: 400 }}>{units} ×</span>
      {set.reps}
      {set.rpe != null && <span className="dim" style={{ fontWeight: 400 }}>@{num(set.rpe, 1)}</span>}
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
