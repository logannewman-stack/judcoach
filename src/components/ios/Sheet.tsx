import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { haptic } from '../../lib/haptics'
import { SheetPortal } from './SheetLayer'
import { useKeyboardInset } from '../../lib/useKeyboardInset'

/** iOS sheet spring: settles fast, no visible bounce. */
export const SHEET_SPRING = { type: 'spring' as const, stiffness: 420, damping: 40, mass: 0.9 }

function useLockedScroll(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

export interface SheetAction {
  label: string
  onPress: () => void
  strong?: boolean
  disabled?: boolean
}

export function Sheet({
  open,
  onClose,
  title,
  left,
  right,
  children,
  /** Fraction of the screen the sheet may occupy. */
  detent = 0.92,
  grabber = true,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  left?: SheetAction
  right?: SheetAction
  children: ReactNode
  detent?: number
  grabber?: boolean
}) {
  useLockedScroll(open)
  const keyboard = useKeyboardInset()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <SheetPortal active={open}>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            style={{
              // Sit on top of the keyboard rather than behind it.
              maxHeight: keyboard > 0 ? `calc(${detent * 100}% - ${keyboard}px)` : `${detent * 100}%`,
              bottom: keyboard,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            drag="y"
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 620) {
                haptic('light')
                onClose()
              }
            }}
            role="dialog"
            aria-modal="true"
          >
            {grabber && <div className="grabber" />}
            {(title || left || right) && (
              <div className="sheet-head">
                <div style={{ justifySelf: 'start' }}>
                  {left && (
                    <button className="nav-btn" type="button" onClick={left.onPress}>
                      {left.label}
                    </button>
                  )}
                </div>
                <div className="t-headline">{title}</div>
                <div style={{ justifySelf: 'end' }}>
                  {right && (
                    <button
                      className={`nav-btn${right.strong ? ' strong' : ''}`}
                      type="button"
                      onClick={right.onPress}
                      disabled={right.disabled}
                    >
                      {right.label}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="sheet-body">
              {children}
              <div className="sheet-safe" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </SheetPortal>
  )
}

/* ----------------------------- action sheet ----------------------------- */

export interface ActionItem {
  label: string
  onPress: () => void
  destructive?: boolean
}

export function ActionSheet({
  open,
  onClose,
  title,
  message,
  items,
  cancelLabel = 'Cancel',
}: {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  items: ActionItem[]
  cancelLabel?: string
}) {
  useLockedScroll(open)
  return (
    <SheetPortal active={open}>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="action-sheet"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={SHEET_SPRING}
            role="dialog"
            aria-modal="true"
          >
            <div className="action-group">
              {(title || message) && (
                <div className="action-title">
                  {title && <div className="semibold" style={{ color: 'var(--label)' }}>{title}</div>}
                  {message && <div>{message}</div>}
                </div>
              )}
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className={`action-item${item.destructive ? ' destructive' : ''}`}
                  onClick={() => {
                    haptic('light')
                    item.onPress()
                    onClose()
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="action-group">
              <button type="button" className="action-item cancel" onClick={onClose}>
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </SheetPortal>
  )
}

/* --------------------------------- alert -------------------------------- */

export function Alert({
  open,
  title,
  message,
  actions,
  onDismiss,
}: {
  open: boolean
  title: string
  message?: ReactNode
  actions: { label: string; onPress: () => void; strong?: boolean; destructive?: boolean }[]
  onDismiss: () => void
}) {
  useLockedScroll(open)
  return (
    <SheetPortal active={open} recede={false}>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onDismiss}
          />
          <motion.div
            className="alert"
            initial={{ opacity: 0, scale: 1.14 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.3, 1] }}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="alert-body">
              <div className="t-headline">{title}</div>
              {message && (
                <div className="t-footnote" style={{ marginTop: 3, lineHeight: '17px' }}>
                  {message}
                </div>
              )}
            </div>
            <div className="alert-actions" style={{ flexDirection: actions.length > 2 ? 'column' : 'row' }}>
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  className={`alert-action${a.strong ? ' strong' : ''}${a.destructive ? ' destructive' : ''}`}
                  onClick={() => {
                    haptic('light')
                    a.onPress()
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </SheetPortal>
  )
}
