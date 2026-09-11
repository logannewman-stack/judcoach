import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SheetPortal } from './SheetLayer'
import { cancelPress } from '../../lib/press'
import { useKeyboardInset } from '../../lib/useKeyboardInset'
import { IOS_PUSH } from '../../nav/Stack'

/* A presentation is the same 0.35s on the same curve as a push, and the sheet,
   its scrim and the screen receding behind it all use it — they were on three
   different rates, so the dimming finished 160ms before the sheet landed. */
const SHEET_TRANSITION = IOS_PUSH

/* Released mid-drag the sheet settles rather than eases, so the return carries
   whatever speed the finger had. Damped hard: iOS does not bounce a sheet. */
const SHEET_SETTLE = { bounceStiffness: 500, bounceDamping: 46 }

/** Distance, in points, the drag has to be heading past to dismiss. */
const DISMISS_AT = 120

/* ============================================================================
   Presentation plumbing.

   UIKit gives a presented view controller four things for free that a portalled
   div does not: what's behind it stops scrolling, stops taking taps and stops
   existing for VoiceOver; focus moves in and comes back out; Tab cannot walk
   out of it; and Escape (a hardware keyboard's swipe-down) dismisses it.
   ========================================================================== */

/* Counted, because a sheet can present another one over it. */
let overlays = 0

function applyOverlayLock() {
  const el = document.querySelector<HTMLElement>('.app-content')
  if (!el) return
  if (overlays > 0) {
    el.dataset.overlay = 'true'
    el.setAttribute('inert', '')
    el.setAttribute('aria-hidden', 'true')
  } else {
    delete el.dataset.overlay
    el.removeAttribute('inert')
    el.removeAttribute('aria-hidden')
  }
}

function useOverlayLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    overlays += 1
    applyOverlayLock()
    return () => {
      overlays -= 1
      applyOverlayLock()
    }
  }, [open])
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useModalFocus(open: boolean, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    // The container takes focus rather than its first control: VoiceOver reads
    // the overlay from the top, and focusing a field here would raise the
    // keyboard over a sheet that is still sliding up.
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (document.activeElement === edge || !node.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0]).focus()
      }
    }
    document.addEventListener('keydown', onKey, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey, true)
      // Skipped when the opener has gone with the screen that held it.
      if (opener && opener !== document.body && opener.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open, ref])
}

/* Every open overlay, innermost last. Escape is the hardware keyboard's
   swipe-down, and a swipe-down dismisses the sheet in front of you — not the one
   behind it as well. Every open overlay had its own window listener, so one
   press closed the lot. */
const escapeStack: (() => void)[] = []

function useEscape(open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return
    const dismiss = () => onDismiss()
    escapeStack.push(dismiss)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (escapeStack[escapeStack.length - 1] !== dismiss) return
      e.stopPropagation()
      onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const at = escapeStack.indexOf(dismiss)
      if (at >= 0) escapeStack.splice(at, 1)
    }
  }, [open, onDismiss])
}

/** The whole presentation contract, keyed to the overlay's own element. */
function usePresentation(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useOverlayLock(open)
  useModalFocus(open, ref)
  useEscape(open, onDismiss)
  return ref
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
  const keyboard = useKeyboardInset()
  const ref = usePresentation(open, onClose)
  const titleId = useId()

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
            transition={SHEET_TRANSITION}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            className="sheet"
            style={{
              // Sit on top of the keyboard rather than behind it.
              maxHeight: keyboard > 0 ? `calc(${detent * 100}% - ${keyboard}px)` : `${detent * 100}%`,
              bottom: keyboard,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_TRANSITION}
            drag="y"
            // Down follows the finger exactly; up gives the little resistance
            // iOS gives a sheet already at its detent. It used to track down at
            // 0.6, which reads as the sheet lagging behind the thumb.
            dragElastic={{ top: 0.06, bottom: 1 }}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragTransition={SHEET_SETTLE}
            onDragStart={cancelPress}
            onDragEnd={(_, info) => {
              // Where the drag was heading, not only where it stopped — the
              // same projection a scroll view decelerates with.
              if (info.offset.y + info.velocity.y * 0.2 > DISMISS_AT) onClose()
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
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
                <div className="t-headline" id={titleId}>{title}</div>
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
  const ref = usePresentation(open, onClose)
  const titleId = useId()
  const messageId = useId()

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
            transition={SHEET_TRANSITION}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            className="action-sheet"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={SHEET_TRANSITION}
            role="dialog"
            aria-modal="true"
            // Name and description apart, as Alert already has them: pointing
            // the name at the whole block made the sheet announce its warning
            // as its title and then read it again as the first thing inside.
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={message ? messageId : undefined}
            tabIndex={-1}
          >
            <div className="action-group">
              {(title || message) && (
                <div className="action-title">
                  {title && <div className="semibold" id={titleId} style={{ color: 'var(--label)' }}>{title}</div>}
                  {message && <div id={messageId}>{message}</div>}
                </div>
              )}
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className={`action-item${item.destructive ? ' destructive' : ''}`}
                  onClick={() => {
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
  const ref = usePresentation(open, onDismiss)
  const titleId = useId()
  const messageId = useId()

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
            transition={SHEET_TRANSITION}
            onClick={onDismiss}
          />
          {/* The host centres; the alert animates. Keeping those on separate
              elements is the whole point — see `.alert-host`. */}
          <div className="alert-host">
            <motion.div
              ref={ref}
              className="alert"
              initial={{ opacity: 0, scale: 1.14 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={SHEET_TRANSITION}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={message ? messageId : undefined}
              tabIndex={-1}
            >
              <div className="alert-body">
                <div className="t-headline" id={titleId}>{title}</div>
                {message && (
                  <div className="t-footnote" id={messageId} style={{ marginTop: 3, lineHeight: '17px' }}>
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
                    onClick={() => a.onPress()}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </SheetPortal>
  )
}
