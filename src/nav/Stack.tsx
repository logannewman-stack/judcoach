import { memo, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useNav } from './nav'
import type { Route, TabKey } from './nav'
import { cancelPress } from '../lib/press'

/** UIKit's push: 0.35s on the navigation controller's own curve. */
const IOS_EASE = [0.32, 0.72, 0, 1] as const
export const IOS_PUSH = { duration: 0.35, ease: IOS_EASE }

export type ScreenRegistry = Record<string, ComponentType<any>>

const EDGE_WIDTH = 24
/** Fraction of the screen a slow drag must cover to count as a back. */
const SWIPE_COMPLETE = 0.32
/** Rightward speed, in px/s, that counts as a flick regardless of distance. */
const FLICK = 320

/* Memoised because the five tab stacks are siblings of everything else in the
   app shell: App re-renders whenever a workout starts, a set is logged or a
   timer ticks, and without this every screen in every tab re-rendered with it.
   Measured at 244 store-connected renders per tab switch and 328 across a
   six-set burst, against 150 and 226 once the stacks whose props did not change
   bail out. */
export const Stack = memo(function Stack({
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
  /* The two screens the live gesture is moving, named by route id rather than
     by depth. Depth changes the instant the stack does, and the screen being
     carried off has to stay bound to the finger's value right through its exit:
     unbind it and framer re-reads the `animate` prop it was rendered with and
     slides it back across the display it has just left. Null when no gesture is
     in flight, which is when both screens sit at their own resting positions. */
  const [driving, setDriving] = useState<{ top: string; below: string } | null>(null)
  const dragX = useMotionValue(0)
  const [width, setWidth] = useState(0)
  /* A tab is built the first time it is selected and kept afterwards, the way
     UITabBarController loads a view controller on demand. Mounting all five at
     launch put four screens the client had not asked for into the first render,
     which on a throttled phone was the difference between a 943 ms and a 506 ms
     first-render task. */
  const [mounted, setMounted] = useState(active)
  if (active && !mounted) setMounted(true)
  /* The tab the app opens on must not slide its own root in, which is what
     `initial={false}` below is for. A tab built later was built because the
     client went there — and a coach card that switches tab and pushes in one
     action still owes the pushed screen its push. */
  const [launchTab] = useState(active)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth))
    ro.observe(el)
    setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [mounted])

  const progress = useTransform(dragX, (x) => (width ? Math.min(Math.max(x / width, 0), 1) : 0))
  const belowX = useTransform(progress, (p) => `${-26 + 26 * p}%`)
  const belowDim = useTransform(progress, (p) => 1 - p)

  const canSwipe = stack.length > 1

  /* The pointer currently driving a back-swipe, and nothing else. A second
     finger on the glass used to run `move` and `up` as if it were the first —
     so an incidental touch anywhere on the screen finished or abandoned a
     gesture the other finger was still in the middle of, and left that finger
     driving nothing. UIScreenEdgePanGestureRecognizer follows the touch it
     started on. */
  const pointer = useRef<number | null>(null)

  /* Interactive edge-swipe back, driven straight off pointer events.

     The recogniser listens on the stack rather than through a strip laid over
     it. A strip is a hit-test target, and for as long as one was mounted
     nothing under the leading 24px of a pushed screen could be reached: a tap
     on a row there did nothing, the back button's own leading third was dead,
     and a vertical drag panned nothing at all, because an absolutely positioned
     sibling of the screen has no scrollable ancestor to pan. UIKit's edge
     recogniser sits on top of a view without taking its touches, and so does
     this one: the press, the tap and the scroll all reach the screen, and the
     gesture only takes the pointer over once the finger has committed to a
     rightward drag. */
  const onEdgePointerDown = (e: React.PointerEvent) => {
    if (!canSwipe || pointer.current !== null || !e.isPrimary) return
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds || e.clientX - bounds.left > EDGE_WIDTH) return

    const id = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    let engaged = false
    pointer.current = id
    // A short trail of samples, so release can read the speed of the gesture
    // rather than only how far it got. iOS pops on a flick from a tenth of the
    // way across; distance alone made every quick back feel like it was ignored.
    const trail: { x: number; t: number }[] = [{ x: startX, t: performance.now() }]

    const speed = () => {
      // Measured between the samples themselves, not against the moment of
      // release: a finger that rests before lifting is not flicking, and
      // including that dead time would say it was.
      const last = trail.at(-1)!
      const from = trail.find((s) => last.t - s.t < 90) ?? trail[0]!
      const dx = last.x - from.x
      const dt = last.t - from.t
      // Barely moved in the window: not a flick in either direction.
      if (Math.abs(dx) < 6) return 0
      // Ground covered inside a millisecond is as fast as a gesture gets. The
      // guard this replaces returned zero here, so the quickest flicks of all —
      // the ones most obviously meant as a flick — read as standing still.
      if (dt < 1) return dx > 0 ? Infinity : -Infinity
      return (dx / dt) * 1000
    }

    const cleanup = () => {
      pointer.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', block)
    }

    /* Without this the browser hands the drag to the scroll view the finger
       landed on — and cancels the pointer driving the transition with it.
       `touch-action` cannot say so: the leading 24px sits over the same scroll
       view the rest of the screen does, and giving it a strip of its own is
       what used to eat every tap and every scroll in that band. So the gesture
       says it out loud instead, and only once it has committed, which leaves a
       vertical drag from the same 24px scrolling the screen normally. */
    function block(ev: TouchEvent) {
      if (engaged && ev.cancelable) ev.preventDefault()
    }

    function move(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!engaged) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) return cleanup()
        if (dx > 6) {
          const top = stack[stack.length - 1]
          const below = stack[stack.length - 2]
          if (!top || !below) return cleanup()
          engaged = true
          // The finger has committed to the gesture, so whatever it landed on
          // is no longer being pressed and is owed no tap. Capturing keeps the
          // rest of the sequence — and the click the release would otherwise
          // land on a row — on the stack itself.
          cancelPress()
          containerRef.current?.setPointerCapture(id)
          // Before the render that binds them, so neither screen is ever bound
          // to a value left over from the last gesture.
          dragX.set(dx)
          setDriving({ top: top.id, below: below.id })
        } else return
      }
      trail.push({ x: ev.clientX, t: performance.now() })
      if (trail.length > 8) trail.shift()
      dragX.set(Math.max(0, dx))
    }

    /** Hands the screen back, carrying whatever speed the finger had. */
    function springBack(v: number) {
      animate(dragX, 0, { type: 'spring', stiffness: 520, damping: 46, velocity: v })
        .then(() => setDriving(null))
    }

    function up(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      cleanup()
      if (!engaged || !width) {
        setDriving(null)
        return
      }
      const dx = Math.max(0, ev.clientX - startX)
      const v = speed()
      // A leftward flick cancels even past the distance threshold, the way
      // pulling a page back onto the screen does on iOS.
      const done = v > FLICK || (v > -FLICK && dx / width > SWIPE_COMPLETE)

      if (!done) return springBack(v)

      // No haptic: iOS gives none for a swipe back, and one here fires on a
      // gesture the client makes dozens of times a session.
      //
      // Carry the screen the rest of the way off from where the finger left it.
      // Dropping dragX to 0 and popping in the same frame — which is what this
      // did — threw the screen the whole way back under the thumb and then
      // slid it out again from scratch: released at 80% of the way across, the
      // next frame had it back at 0. A flick finishes at its own speed, a slow
      // drag over the share of the push's duration it has left to travel.
      const left = width - dx
      const duration = v > FLICK
        ? Math.min(IOS_PUSH.duration, Math.max(0.1, left / v))
        : Math.max(0.1, IOS_PUSH.duration * (left / width))
      // `driving` is deliberately left standing: it is what keeps the screen
      // that has just gone off the display bound to dragX while it unmounts,
      // and what tells the one underneath that it is already home. The exit
      // clears it (onExitComplete below).
      animate(dragX, width, { duration, ease: IOS_EASE }).then(pop)
    }

    function cancel(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      cleanup()
      if (!engaged) return setDriving(null)
      // A cancelled pointer reports no position worth reading, so the gesture
      // is abandoned rather than judged on a clientX of zero — which is what
      // sent a nearly complete swipe springing backwards.
      springBack(0)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    // Before the first touchmove, which is the one the browser is still willing
    // to have cancelled — and the one it decides to start scrolling on.
    window.addEventListener('touchmove', block, { passive: false })
  }

  if (!mounted) return null

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={onEdgePointerDown}
      style={{
        position: 'absolute',
        inset: 0,
        visibility: active ? 'visible' : 'hidden',
        pointerEvents: active ? 'auto' : 'none',
      }}
      data-stack-active={active}
      aria-hidden={!active}
    >
      {/* Both screens the gesture was moving are unbound here, and not before:
          by now the one that left has unmounted and the one that stayed is at
          rest, so handing x back to the animate props above changes nothing. */}
      <AnimatePresence
        initial={!launchTab}
        onExitComplete={() => {
          setDriving(null)
          dragX.set(0)
        }}
      >
        {stack.map((r: Route, i: number) => {
          const depth = stack.length - 1 - i
          if (depth > 1) return null
          const Component = registry[r.key]
          if (!Component) return null
          const isTop = depth === 0
          const driven = driving?.top === r.id
          const under = driving?.below === r.id

          return (
            <motion.div
              key={r.id}
              initial={i === 0 ? false : { x: '100%' }}
              animate={{ x: isTop ? 0 : '-26%' }}
              /* Three ways off, and only one of them is an animation.

                 A screen the finger has just carried off is already gone: it
                 leaves at once, which is also what releases it from the gesture
                 (see onExitComplete) before another swipe can start.

                 A screen dropped from *below* the top is a popToRoot, or the
                 tab you are already on being re-tapped. UINavigationController
                 animates only the top view controller off and removes the ones
                 under it without animation; animating this one sent a screen
                 the client had not asked for wiping across the root it was
                 supposed to be uncovering.

                 Everything else is an ordinary pop, and slides. */
              exit={
                driven || !isTop
                  ? { x: '100%', transition: { duration: 0 } }
                  : { x: '100%' }
              }
              transition={IOS_PUSH}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: i,
                ...(driven ? { x: dragX } : under ? { x: belowX } : null),
                boxShadow: i > 0 && isTop ? 'var(--shadow-push)' : undefined,
              }}
            >
              <Component {...(r.params ?? {})} />
              {!isTop && (
                <motion.div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--push-dim)',
                    pointerEvents: 'none',
                    ...(under ? { opacity: belowDim } : null),
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0 } }}
                  transition={IOS_PUSH}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
})
