import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { haptic } from '../../lib/haptics'

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

  useEffect(() => {
    if (id && openId !== id && open) {
      setOpen(false)
    }
  }, [openId, id, open])

  const commit = () => {
    const last = actions[actions.length - 1]
    if (!last) return
    haptic('warning')
    setOpen(false)
    onOpenChange?.(null)
    last.onPress()
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          opacity: trayOpacity,
        }}
        aria-hidden={!open}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false)
              onOpenChange?.(null)
              action.onPress()
            }}
            style={{
              width: ACTION_W,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: action.destructive ? 'var(--red)' : 'var(--gray)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {action.icon && <Icon name={action.icon} size={19} weight={2} color="#fff" />}
            {action.label}
          </button>
        ))}
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={{ left: 0.35, right: 0 }}
        dragMomentum={false}
        style={{ x, position: 'relative', background: 'var(--grouped-2)' }}
        animate={{ x: open ? -width : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 44 }}
        onDragEnd={(_, info) => {
          if (-info.offset.x > COMMIT_AT && actions.some((a) => a.destructive)) {
            commit()
            return
          }
          const shouldOpen = -info.offset.x > OPEN_AT || info.velocity.x < -420
          setOpen(shouldOpen)
          onOpenChange?.(shouldOpen ? (id ?? null) : null)
          if (shouldOpen) haptic('selection')
        }}
        onPointerDownCapture={() => {
          if (open) {
            setOpen(false)
            onOpenChange?.(null)
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
