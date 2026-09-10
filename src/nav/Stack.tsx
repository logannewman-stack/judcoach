import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { useNav } from './nav'
import type { Route, TabKey } from './nav'
import { haptic } from '../lib/haptics'

/** UIKit's push curve. */
export const IOS_PUSH = { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const }

export type ScreenRegistry = Record<string, ComponentType<any>>

const EDGE_WIDTH = 24
const SWIPE_COMPLETE = 0.32

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
      dragX.set(Math.max(0, dx))
    }
    function up(ev: PointerEvent) {
      const dx = ev.clientX - startX
      cleanup()
      setSwiping(false)
      dragX.set(0)
      if (engaged && width && dx / width > SWIPE_COMPLETE) {
        haptic('light')
        pop()
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
