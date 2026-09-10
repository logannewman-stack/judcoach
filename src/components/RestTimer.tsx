import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Icon } from './Icon'
import { formatDuration } from '../lib/date'
import { haptic } from '../lib/haptics'

/**
 * Floating rest timer. Sits above the tab bar so it stays visible wherever the
 * client wanders mid-session, and counts against wall-clock time so a locked
 * screen or a backgrounded tab never drifts.
 */
export function RestTimerBar({ bottomOffset }: { bottomOffset: number }) {
  const timer = useStore((s) => s.restTimer)
  const stopRest = useStore((s) => s.stopRest)
  const adjustRest = useStore((s) => s.adjustRest)
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timer])

  const remaining = timer ? Math.max(0, (timer.endsAt - now) / 1000) : 0
  const progress = timer ? 1 - remaining / timer.totalSec : 0

  useEffect(() => {
    if (!timer) {
      setFinished(false)
      return
    }
    if (remaining <= 0 && !finished) {
      setFinished(true)
      haptic('success')
    }
  }, [remaining, timer, finished])

  const size = 34
  const r = (size - 4) / 2
  const circumference = 2 * Math.PI * r

  return (
    <AnimatePresence>
      {timer && (
        <motion.div
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 70, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: bottomOffset,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 8px 8px 12px',
            borderRadius: 16,
            background: 'var(--chrome-solid)',
            WebkitBackdropFilter: 'blur(24px)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'var(--shadow-float)',
            border: finished ? '1.5px solid var(--green)' : '1.5px solid transparent',
          }}
          role="timer"
          aria-live="off"
        >
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flex: 'none' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-3)" strokeWidth={3} />
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={finished ? 'var(--green)' : 'var(--accent)'}
              strokeWidth={3} strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.min(progress, 1))}
            />
          </svg>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="mono-nums"
              style={{
                fontSize: 19,
                lineHeight: '22px',
                fontWeight: 700,
                letterSpacing: -0.4,
                color: finished ? 'var(--green)' : 'var(--label)',
              }}
            >
              {finished ? 'Rest complete' : formatDuration(remaining)}
            </div>
            <div className="t-caption1 dim truncate">{timer.label}</div>
          </div>

          <button
            type="button"
            aria-label="Subtract 15 seconds"
            onClick={() => adjustRest(-15)}
            style={pillBtn}
          >
            −15
          </button>
          <button
            type="button"
            aria-label="Add 15 seconds"
            onClick={() => adjustRest(15)}
            style={pillBtn}
          >
            +15
          </button>
          <button
            type="button"
            aria-label="Skip rest"
            onClick={() => {
              haptic('light')
              stopRest()
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: finished ? 'var(--green)' : 'var(--accent)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <Icon name={finished ? 'check' : 'play.fill'} size={16} weight={2.6} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const pillBtn: React.CSSProperties = {
  flex: 'none',
  minWidth: 42,
  height: 30,
  borderRadius: 9,
  background: 'var(--fill-3)',
  color: 'var(--label)',
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
}
