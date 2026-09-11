import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GritTile, Wordmark } from './Logo'
import { encodeQr } from '../lib/qr'
import type { QrMatrix } from '../lib/qr'
import '../styles/device.css'

/* ============================================================================
   Phone presentation.

   On a phone this is a pass-through — the app fills the viewport and the real
   status bar and home indicator are the device's own, and none of the stage
   below is rendered at all.

   On a desktop it becomes two things: a hardware frame, so the layout is seen
   at the size it was designed for rather than stretched across a monitor, and
   a column beside it. Whoever opens this on a laptop is Jud or someone being
   shown the app, never a client mid-workout, so the column answers what they
   came for — what this is, and how to get it onto the phone in their hand.
   ========================================================================== */

const DEVICE_W = 396
const DEVICE_H = 858

/* The two bands device.css draws, restated because the phone has to be sized
   to whatever the stage has not already spent. Keep them in step. */
const WIDE_W = 1000
const WIDE_H = 700
const PANEL_W = 340

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

type Stage = { band: 'none' | 'framed' | 'wide'; scale: number }

/**
 * Which band the window is in, and the scale that fits a real 396pt iPhone into
 * what is left of it. The phone is never scaled past 1: a screenshot blown up
 * to 140% on a 27in display stops being a phone and starts being a poster.
 */
function measure(): Stage {
  if (typeof window === 'undefined') return { band: 'none', scale: 1 }
  const w = window.innerWidth
  const h = window.innerHeight
  if (w < 720 || h < 680) return { band: 'none', scale: 1 }
  const wide = w >= WIDE_W && h >= WIDE_H
  // What the stage has already spent: its own padding, the column and the gap
  // in the wide band, and the caption under the phone in a tall narrow one.
  const gap = Math.min(96, Math.max(52, w * 0.06))
  const beside = wide ? 80 + PANEL_W + gap : 48
  const above = wide ? 64 : h > 820 ? 136 : 52
  const scale = Math.min(1, (h - above) / DEVICE_H, (w - beside) / DEVICE_W)
  return { band: wide ? 'wide' : 'framed', scale: Math.max(0.42, scale) }
}

function useStage(): Stage {
  const [stage, setStage] = useState(measure)
  useEffect(() => {
    const onResize = () => setStage((prev) => {
      const next = measure()
      return prev.band === next.band && prev.scale === next.scale ? prev : next
    })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return stage
}

/**
 * One <path> rather than a thousand <rect>s, and no crisp-edges: the modules
 * are subpaths of a single fill, so shared edges are interior and the code
 * survives being drawn at a size that is not a whole multiple of its grid.
 */
function QrSymbol({ code, size }: { code: QrMatrix; size: number }) {
  const quiet = 4
  const span = code.size + quiet * 2
  const d = useMemo(() => {
    let path = ''
    for (let y = 0; y < code.size; y += 1) {
      for (let x = 0; x < code.size; x += 1) {
        if (code.dark(x, y)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`
      }
    }
    return path
  }, [code])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} aria-hidden="true">
      <rect width={span} height={span} fill="var(--qr-paper, #fff)" />
      <path d={d} fill="var(--qr-ink, #000)" />
    </svg>
  )
}

/**
 * The column beside the phone. Deliberately three blocks and no fourth: the
 * identity, one sentence of what the app does, and the way onto a phone. An
 * empty field would be better than a hero, so nothing here is here to fill
 * space — the QR is the reason the column exists.
 */
function StagePanel() {
  const url = window.location.origin + window.location.pathname
  const code = useMemo(() => encodeQr(url), [url])
  const shown = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <div className="stage-panel">
      <div className="stage-identity">
        <GritTile size={52} />
        <Wordmark size={30} />
      </div>
      <p className="stage-lede">
        Percentage- and RPE-based programming, macro targets and weigh-in trends.
        Jud’s coaching, on the phone it is executed from.
      </p>
      <div className="stage-install">
        <span className="eyebrow">On your phone</span>
        <div className="stage-install-row">
          {code && (
            <span className="stage-qr">
              <QrSymbol code={code} size={104} />
            </span>
          )}
          <div className="stage-install-copy">
            <p>
              Scan to open GRIT, then Share → <strong>Add to Home Screen</strong>.
            </p>
            <span className="data stage-url">{shown}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DeviceFrame({ children }: { children: ReactNode }) {
  const { band, scale } = useStage()
  return (
    <div className="stage" style={{ ['--device-scale' as string]: scale }}>
      {band === 'wide' && <StagePanel />}
      <div className="device-wrap">
        <div className="device">
          {band !== 'none' && (
            <>
              <span className="device-keys" data-side="left" aria-hidden="true" />
              <span className="device-keys" data-side="right" aria-hidden="true" />
            </>
          )}
          <div className="device-screen">
            <span className="dynamic-island" aria-hidden="true" />
            {/* The clock is the frame's, not the phone's — a real device draws
                its own status bar, so off the stage there is nothing to tick. */}
            {band !== 'none' && <StatusBar />}
            {children}
            <span className="home-indicator" aria-hidden="true" />
          </div>
        </div>
      </div>
      {band === 'framed' && (
        <div className="stage-caption">
          <Wordmark size={20} />
          <p>
            Open on your iPhone in Safari, then Share → <strong>Add to Home Screen</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
