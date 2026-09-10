import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Wordmark } from './Logo'

/* ============================================================================
   Phone presentation.

   On a phone this is a pass-through — the app fills the viewport and the real
   status bar and home indicator are the device's own. On a desktop-sized
   viewport it becomes a hardware frame so the layout is seen at the size it was
   designed for, rather than stretched across a monitor.
   ========================================================================== */

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Tick on the minute boundary rather than every second.
    let timeout: number
    const schedule = () => {
      const next = 60000 - (Date.now() % 60000) + 50
      timeout = window.setTimeout(() => {
        setNow(new Date())
        schedule()
      }, next)
    }
    schedule()
    return () => window.clearTimeout(timeout)
  }, [])
  const hours = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12
  return `${hours}:${String(now.getMinutes()).padStart(2, '0')}`
}

function StatusBar() {
  const time = useClock()
  return (
    <div className="status-bar" aria-hidden="true">
      <span className="status-time mono-nums">{time}</span>
      <span className="status-icons">
        {/* cellular */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 4.6}
              y={9 - i * 2.6}
              width="3"
              height={3 + i * 2.6}
              rx="1"
              fill="currentColor"
            />
          ))}
        </svg>
        {/* wi-fi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M1 4.1a10.5 10.5 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M3.7 6.9a6.7 6.7 0 0 1 8.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6.4 9.6a2.8 2.8 0 0 1 3.2 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {/* battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
          <rect x="2.2" y="2.2" width="15" height="7.6" rx="2" fill="currentColor" />
          <path d="M23 4.3v3.4a2 2 0 0 0 0-3.4Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  )
}

/**
 * Scales the whole phone as one unit instead of letting the frame squash, so
 * the app always lays out at a real 396pt iPhone width no matter the window.
 */
function useDeviceScale() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const framed = window.matchMedia('(min-width: 720px) and (min-height: 680px)')
    const compute = () => {
      if (!framed.matches) {
        setScale(1)
        return
      }
      const chrome = window.innerHeight > 820 ? 128 : 52
      const next = Math.min(
        1,
        (window.innerHeight - chrome) / DEVICE_H,
        (window.innerWidth - 48) / DEVICE_W,
      )
      setScale(Math.max(0.42, next))
    }
    compute()
    window.addEventListener('resize', compute)
    framed.addEventListener('change', compute)
    return () => {
      window.removeEventListener('resize', compute)
      framed.removeEventListener('change', compute)
    }
  }, [])
  return scale
}

const DEVICE_W = 396
const DEVICE_H = 858

export function DeviceFrame({ children }: { children: ReactNode }) {
  const scale = useDeviceScale()
  return (
    <div className="stage">
      <div
        className="device-wrap"
        style={{ ['--device-scale' as string]: scale }}
      >
      <div className="device">
        <div className="device-screen">
          <span className="dynamic-island" aria-hidden="true" />
          <StatusBar />
          {children}
          <span className="home-indicator" aria-hidden="true" />
        </div>
      </div>
      </div>
      <div className="stage-caption">
        <Wordmark size={17} align="center" />
        <p>
          Open on your iPhone in Safari, then Share → <strong>Add to Home Screen</strong>.
        </p>
      </div>
    </div>
  )
}
