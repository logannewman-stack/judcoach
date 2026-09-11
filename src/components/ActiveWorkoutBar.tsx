import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useNav } from '../nav/nav'
import { findSession, useProgram } from '../store/selectors'
import { Icon } from './Icon'
import { formatDuration } from '../lib/date'

/**
 * The way back into a minimised workout, from anywhere in the app — iOS's
 * in-call banner, for lifting. Yields to the rest timer, which is the more
 * urgent thing to look at while it's counting.
 */
export function ActiveWorkoutBar({ bottomOffset }: { bottomOffset: number | string }) {
  const active = useStore((s) => s.active)
  const restTimer = useStore((s) => s.restTimer)
  const fullScreen = useNav((s) => s.fullScreen)
  const present = useNav((s) => s.present)
  const program = useProgram()
  const [elapsed, setElapsed] = useState(0)

  const visible = !!active && !restTimer && !fullScreen

  useEffect(() => {
    if (!active) return
    const started = new Date(active.startedAt).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - started) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [active])

  const found = active ? findSession(program, active.weekIndex, active.sessionId) : undefined
  const done = active ? Object.values(active.entries).reduce((n, sets) => n + sets.length, 0) : 0
  const total = found?.session.blocks.reduce((n, b) => n + b.sets.length, 0) ?? 0

  return (
    <AnimatePresence>
      {visible && active && (
        <motion.button
          type="button"
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 70, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          onClick={() => {
            present('runner', { weekIndex: active.weekIndex, sessionId: active.sessionId })
          }}
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: bottomOffset,
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '9px 10px 9px 13px',
            borderRadius: 'var(--r-sheet)',
            background: 'var(--accent)',
            color: '#fff',
            boxShadow: 'var(--shadow-float)',
            textAlign: 'left',
          }}
          aria-label="Resume workout"
        >
          <motion.span
            aria-hidden="true"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', flex: 'none' }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              className="eyebrow truncate"
              style={{ display: 'block', color: 'inherit', opacity: 0.82 }}
            >
              Workout in progress
            </span>
            <span className="t-subhead semibold truncate" style={{ display: 'block' }}>
              {found?.session.name ?? 'Session'}
              <span className="data"> · {formatDuration(elapsed)}</span>
              <span className="data" style={{ opacity: 0.8, fontWeight: 500 }}> · {done}/{total} sets</span>
            </span>
          </span>
          <span
            style={{
              flex: 'none',
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'color-mix(in srgb, #fff 22%, transparent)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="chevron.up" size={17} weight={2.6} color="#fff" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
