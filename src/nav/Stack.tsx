import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useNav } from './nav'
import type { Route, TabKey } from './nav'
import { haptic } from '../lib/haptics'

/** UIKit's push: 0.35s on the navigation controller's own curve. */
const IOS_EASE = [0.32, 0.72, 0, 1] as const
export const IOS_PUSH = { duration: 0.35, ease: IOS_EASE }

export type ScreenRegistry = Record<string, ComponentType<any>>

const EDGE_WIDTH = 24
/** Fraction of the screen a slow drag must cover to count as a back. */
const SWIPE_COMPLETE = 0.32
/** Rightward speed, in px/s, that counts as a flick regardless of distance. */
const FLICK = 320

export function Stack({
  tab,
  registry,
  active,
}: {
  tab: TabKey
  registry: ScreenRegistry
  active: boolean
}) {
  const stack = useNav((s) => s.stacks[tab])
  const pop = useNav((s) => s.pop)
  const containerRef = useRef<HTMLDivElement>(null)
  const [swiping, setSwiping] = useState(false)
  const dragX = useMotionValue(0)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth))
    ro.observe(el)
    setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const progress = useTransform(dragX, (x) => (width ? Math.min(Math.max(x / width, 0), 1) : 0))
  const belowX = useTransform(progress, (p) => `${-26 + 26 * p}%`)
  const belowDim = useTransform(progress, (p) => 1 - p)

  const canSwipe = stack.length > 1

  /** Interactive edge-swipe back, driven straight off pointer events. */
  const onEdgePointerDown = (e: React.PointerEvent) => {
    if (!canSwipe) return
    const startX = e.clientX
    const startY = e.clientY
    let engaged = false
    dragX.set(0)
    // A short trail of samples, so release can read the speed of the gesture
    // rather than only how far it got. iOS pops on a flick from a tenth of the
    // way across; distance alone made every quick back feel like it was ignored.
    const trail: { x: number; t: number }[] = [{ x: startX, t: performance.now() }]

    const speed = () => {
      const now = performance.now()
      const from = trail.find((s) => now - s.t < 90) ?? trail[0]!
      const dt = now - from.t
      return dt > 8 ? ((trail.at(-1)!.x - from.x) / dt) * 1000 : 0
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!engaged) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) return cleanup()
        if (dx > 6) {
          engaged = true
          setSwiping(true)
        } else return
      }
      trail.push({ x: ev.clientX, t: performance.now() })
      if (trail.length > 8) trail.shift()
      dragX.set(Math.max(0, dx))
    }
    function up(ev: PointerEvent) {
      cleanup()
      if (!engaged || !width) {
        setSwiping(false)
        return
      }
      const dx = Math.max(0, ev.clientX - startX)
      const v = speed()
      // A leftward flick cancels even past the distance threshold, the way
      // pulling a page back onto the screen does on iOS.
      const done = v > FLICK || (v > -FLICK && dx / width > SWIPE_COMPLETE)

      if (done) {
        haptic('light')
        // Hand the screen straight to the exit animation. Carrying it the rest
        // of the way on dragX first reads better, but the element has to be
        // unbound from dragX for AnimatePresence to remove it, and unbinding
        // after a release cancels the exit and leaves the popped screen mounted
        // on top of the live one.
        setSwiping(false)
        dragX.set(0)
        pop()
      } else {
        animate(dragX, 0, { type: 'spring', stiffness: 520, damping: 46, velocity: v })
          .then(() => setSwiping(false))
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        visibility: active ? 'visible' : 'hidden',
        pointerEvents: active ? 'auto' : 'none',
      }}
      data-stack-active={active}
      aria-hidden={!active}
    >
      <AnimatePresence initial={false}>
        {stack.map((r: Route, i: number) => {
          const depth = stack.length - 1 - i
          if (depth > 1) return null
          const Component = registry[r.key]
          if (!Component) return null
          const isTop = depth === 0

          return (
            <motion.div
              key={r.id}
              initial={i === 0 ? false : { x: '100%' }}
              animate={{ x: isTop ? 0 : '-26%' }}
              exit={{ x: '100%' }}
              transition={IOS_PUSH}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: i,
                ...(swiping ? { x: isTop ? dragX : belowX } : null),
                boxShadow: i > 0 && isTop ? '-10px 0 30px rgba(0,0,0,0.13)' : undefined,
              }}
            >
              <Component {...(r.params ?? {})} />
              {!isTop && (
                <motion.div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.14)',
                    pointerEvents: 'none',
                    ...(swiping ? { opacity: belowDim } : null),
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={IOS_PUSH}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {canSwipe && (
        <div
          onPointerDown={onEdgePointerDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: EDGE_WIDTH,
            zIndex: 50,
            touchAction: 'pan-y',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
