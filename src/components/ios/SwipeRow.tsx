import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { haptic } from '../../lib/haptics'
import { cancelPress } from '../../lib/press'

/* ============================================================================
   Swipe-to-reveal list row.

   Drag left to expose the actions; keep dragging past the far threshold and the
   last action fires straight away, the way Mail deletes a message. Everything
   stays reachable without the gesture — the row's own onPress still works, and
   each action is a real button for keyboard and screen-reader users.
   ========================================================================== */

export interface SwipeAction {
  label: string
  icon?: IconName
  onPress: () => void
  /** Red, and the one a full swipe commits to. */
  destructive?: boolean
}

const ACTION_W = 82
const OPEN_AT = 40
const COMMIT_AT = 190
/** Past this much travel the gesture was a swipe, so its click isn't a tap. */
const TAP_SLOP = 8

export function SwipeRow({
  children,
  actions,
  /** Set by the list so opening one row closes its neighbours. */
  openId,
  id,
  onOpenChange,
}: {
  children: ReactNode
  actions: SwipeAction[]
  openId?: string | null
  id?: string
  onOpenChange?: (id: string | null) => void
}) {
  const width = actions.length * ACTION_W
  const x = useMotionValue(0)
  const [open, setOpen] = useState(false)
  // The action tray only needs to paint while the row is actually moving.
  const trayOpacity = useTransform(x, [-8, -28], [0, 1])
  const from = useRef<{ x: number; y: number } | null>(null)
  const armed = useRef(false)
  // Only a destructive action at the end of the tray is what a full swipe
  // commits to, the way Mail's delete is.
  const last = actions[actions.length - 1]
  const fullSwipe = last?.destructive ? last : null

  useEffect(() => {
    if (id && openId !== id && open) {
      setOpen(false)
    }
  }, [openId, id, open])

  const commit = () => {
    if (!fullSwipe) return
    // No haptic: the swipe already tapped back when it armed, and one event
    // should only ever be felt once.
    setOpen(false)
    onOpenChange?.(null)
    fullSwipe.onPress()
  }

  return (
    <div className="swipe-row">
      {/* The tray carries the last action's colour so pulling past the actions
          stretches that colour, rather than opening a gap of bare row. */}
      <motion.div
        className="swipe-row-tray"
        style={{
          opacity: trayOpacity,
          background: last ? (last.destructive ? 'var(--red)' : 'var(--gray)') : undefined,
        }}
        aria-hidden={!open}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            type="button"
            className={`swipe-row-action${action.destructive ? ' destructive' : ''}`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false)
              onOpenChange?.(null)
              action.onPress()
            }}
            style={{ width: ACTION_W }}
          >
            {action.icon && <Icon name={action.icon} size={19} weight={2} color="#fff" />}
            {action.label}
          </button>
        ))}
      </motion.div>

      <motion.div
        className="swipe-row-sled"
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={{ left: 0.35, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        animate={{ x: open ? -width : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 44 }}
        onDragStart={cancelPress}
        // iOS taps you the moment a full swipe arms, not when you let go of it.
        onDrag={(_, info) => {
          const arm = !!fullSwipe && -info.offset.x > COMMIT_AT
          if (arm === armed.current) return
          armed.current = arm
          if (arm) haptic('medium')
        }}
        onDragEnd={(_, info) => {
          armed.current = false
          if (fullSwipe && -info.offset.x > COMMIT_AT) {
            commit()
            return
          }
          // Revealing the actions is not a selection, and Mail does not buzz
          // for it either.
          const shouldOpen = -info.offset.x > OPEN_AT || info.velocity.x < -420
          setOpen(shouldOpen)
          onOpenChange?.(shouldOpen ? (id ?? null) : null)
        }}
        onPointerDownCapture={(e) => {
          from.current = { x: e.clientX, y: e.clientY }
          if (open) {
            setOpen(false)
            onOpenChange?.(null)
          }
        }}
        // A press that turned into a swipe must not also fire the row's own
        // action: the gesture and the tap ride the same pointer sequence.
        // Keyboard activation (`detail === 0`) is never suppressed.
        onClickCapture={(e) => {
          const start = from.current
          if (!start || e.detail === 0) return
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/** Tracks which row in a list is open, so only one ever is. */
export function useSwipeGroup() {
  const [openId, setOpenId] = useState<string | null>(null)
  return { openId, onOpenChange: setOpenId }
}
