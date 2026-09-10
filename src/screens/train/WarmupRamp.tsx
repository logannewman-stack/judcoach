import { motion } from 'framer-motion'
import { Icon } from '../../components/Icon'
import { haptic } from '../../lib/haptics'
import { num } from '../../lib/format'
import type { WarmupSet } from '../../domain/strength'

/**
 * The ramp to the first working set, as a checklist. Warm-ups are deliberately
 * not logged as sets — they'd pollute volume, estimated maxes and PRs — but
 * ticking them off is how a lifter keeps their place, so the count lives with
 * the session and survives leaving the screen.
 */
export function WarmupRamp({
  sets,
  units,
  done,
  onChange,
}: {
  sets: WarmupSet[]
  units: string
  done: number
  onChange: (count: number) => void
}) {
  if (sets.length === 0) return null
  const complete = done >= sets.length

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 7,
        }}
      >
        <span className="t-caption1 dim semibold" style={{ letterSpacing: 0.3 }}>
          WARM-UP RAMP
        </span>
        <span className="t-caption1 mono-nums" style={{ color: complete ? 'var(--green)' : 'var(--label-3)' }}>
          {complete ? 'Ready' : `${done}/${sets.length}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {sets.map((set, i) => {
          const isDone = i < done
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isDone}
              aria-label={`Warm-up ${num(set.weight, 1)} ${units} for ${set.reps} reps`}
              onClick={() => {
                haptic('selection')
                // Tapping a rung completes everything up to it; tapping the last
                // completed rung steps back one.
                onChange(isDone && i === done - 1 ? i : i + 1)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 11px',
                borderRadius: 10,
                background: isDone ? 'rgba(52,199,89,0.14)' : 'var(--fill-4)',
                color: isDone ? 'var(--green)' : 'var(--label-2)',
                transition: 'background 140ms ease, color 140ms ease',
              }}
            >
              <motion.span
                initial={false}
                animate={{ scale: isDone ? 1 : 0.6, opacity: isDone ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                style={{ display: 'grid', placeItems: 'center', width: isDone ? 13 : 0 }}
              >
                <Icon name="check" size={12} weight={3.2} color="var(--green)" />
              </motion.span>
              <span className="mono-nums" style={{ fontSize: 13, fontWeight: 600 }}>
                {num(set.weight, 1)}
                <span style={{ opacity: 0.65, fontWeight: 400 }}> × {set.reps}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
