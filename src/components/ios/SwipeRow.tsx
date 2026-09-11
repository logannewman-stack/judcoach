import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { haptic } from '../../lib/haptics'
import { cancelPress } from '../../lib/press'

/* ============================================================================
   Swipe-to-reveal list row.

   Drag left to expose the actions; keep dragging past the far threshold and the
   last action fires straight away, the way Mail deletes a message.

   Nothing here is reachable by the gesture alone. The tray's buttons are out of
   the tab order and hidden from the reader while it is shut — a tab stop on
   something that is not on screen is worse than no tab stop — so the keyboard
   gets the same two moves the finger has: ArrowLeft opens the tray and lands on
   the first action, ArrowRight or Escape shuts it and hands focus back to the
   row. A call site is still expected to offer the action somewhere permanent as
   well, the way Mail keeps Delete in the message itself: a swipe is a shortcut,
   and a shortcut is not a route.
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
  /* Whether the press now on the row is only here to put a tray away. Decided
     on the way down, because by the time it is released the group has changed
     under it — and acted on at the release, because framer's drag owns `x`
     from the pointerdown onwards and simply ignores the `animate` below while
     it does. Closing on the way down is what left the sled wedged at -82 with
     the row believing it was shut: the tray still on screen, still deleting
     things a finger landed on, and out of the tab order the whole time. */
  const dismissing = useRef(false)
  const armed = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  // Only a destructive action at the end of the tray is what a full swipe
  // commits to, the way Mail's delete is.
  const last = actions[actions.length - 1]
  const fullSwipe = last?.destructive ? last : null

  useEffect(() => {
    if (id && openId !== id && open) {
      setOpen(false)
    }
  }, [openId, id, open])

  /* Shutting the tray takes its buttons out of the tab order, so if focus was on
     one it would be left on an element nothing can reach — which drops the
     keyboard back to the top of the document. Hand it to the row instead.

     `restore` is off when an action has fired, because the action's whole job is
     often to delete the row the focus would be handed to. */
  const shut = (restore = true) => {
    const insideTray = tray.current?.contains(document.activeElement) ?? false
    setOpen(false)
    onOpenChange?.(null)
    if (!restore || !insideTray) return
    root.current
      ?.querySelector<HTMLElement>('.swipe-row-sled button, .swipe-row-sled [href]')
      ?.focus()
  }

  const reveal = () => {
    setOpen(true)
    onOpenChange?.(id ?? null)
    // After the state lands, so the button it focuses is in the tab order.
    requestAnimationFrame(() => tray.current?.querySelector<HTMLElement>('button')?.focus())
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // A control inside the row that handles its own arrows — a segmented
    // control, a slider — has already said so.
    if (e.defaultPrevented || actions.length === 0) return
    if (e.key === 'ArrowLeft' && !open) {
      e.preventDefault()
      reveal()
    } else if ((e.key === 'ArrowRight' || e.key === 'Escape') && open) {
      e.preventDefault()
      // The tray is the innermost thing open, so this press belongs to it: a
      // sheet holding the row must not also close on the same Escape.
      e.stopPropagation()
      shut()
    }
  }

  const commit = () => {
    if (!fullSwipe) return
    // No haptic: the swipe already tapped back when it armed, and one event
    // should only ever be felt once.
    setOpen(false)
    onOpenChange?.(null)
    fullSwipe.onPress()
  }

  return (
    <div className="swipe-row" ref={root} onKeyDown={onKeyDown}>
      {/* The tray carries the last action's colour so pulling past the actions
          stretches that colour, rather than opening a gap of bare row. */}
      <motion.div
        ref={tray}
        className="swipe-row-tray"
        style={{
          opacity: trayOpacity,
          // A tray the reader is told is not there must not be reachable by a
          // finger either. It sits behind the sled, so this only matters when
          // something has gone wrong — and when something goes wrong, the thing
          // left under the thumb here is Delete.
          pointerEvents: open ? 'auto' : 'none',
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
              shut(false)
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
          // An open tray anywhere in the list is what this press is for — iOS's
          // first tap on a swiped-open row only puts it away, and puts away a
          // neighbour's just the same rather than following the row you hit.
          dismissing.current = open || (openId != null && openId !== id)
        }}
        onPointerUpCapture={(e) => {
          if (!dismissing.current) return
          const start = from.current
          // A press that travelled is a drag, and the drag's own release has
          // already decided what the tray does.
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
            dismissing.current = false
            return
          }
          shut()
        }}
        // A press that turned into a swipe must not also fire the row's own
        // action, and neither must one that was only here to shut a tray: the
        // gesture and the tap ride the same pointer sequence. Keyboard
        // activation (`detail === 0`) is never suppressed.
        onClickCapture={(e) => {
          if (e.detail === 0) return
          const start = from.current
          const swiped = !!start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP
          if (dismissing.current || swiped) {
            e.preventDefault()
            e.stopPropagation()
          }
          dismissing.current = false
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
