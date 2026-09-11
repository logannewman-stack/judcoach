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
 *
 * Nothing here takes the intensity ramp: a warm-up sits below RPE 6, and the
 * scale has no colour for that. What the rung states carry instead is position
 * in the queue — done rungs go quiet, and the one to walk to next is the only
 * one drawn in full.
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
        <span className="eyebrow">Warm-up ramp</span>
        <span
          className="eyebrow"
          style={{ color: complete ? 'var(--green-text)' : undefined }}
        >
          {complete ? 'Ready' : `${done} of ${sets.length}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {sets.map((set, i) => {
          const isDone = i < done
          return (
            <button
              key={i}
              type="button"
              className="warmup-rung"
              data-state={isDone ? 'done' : i === done ? 'next' : undefined}
              aria-pressed={isDone}
              aria-label={`Warm-up ${num(set.weight, 1)} ${units} for ${set.reps} reps`}
              onClick={() => {
                haptic('selection')
                // Tapping a rung completes everything up to it; tapping the last
                // completed rung steps back one.
                onChange(isDone && i === done - 1 ? i : i + 1)
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
              <span className="data warmup-num">
                {num(set.weight, 1)}
                <span className="warmup-reps"> × {set.reps}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
