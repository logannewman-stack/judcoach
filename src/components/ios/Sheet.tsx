import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
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
const SHEET_SETTLE = { type: 'spring', stiffness: 500, damping: 46 } as const

/* An alert does bounce, a little. It does not slide in from anywhere — it
   appears in the middle of the screen — so the only thing that can say "this
   just arrived" is the way it settles into its own size (DESIGN.md §5). The
   dismissal stays on the push curve: leaving is not an event. */
const ALERT_ARRIVE = { type: 'spring', stiffness: 560, damping: 30, mass: 0.8 } as const

/** Distance, in points, the drag has to be heading past to dismiss. */
const DISMISS_AT = 120
/* Downward travel before the sheet starts following the finger — UIKit's own
   pan threshold. Under it, and in every other direction, the sheet claims
   nothing: it is already at its detent, so there is nothing an upward or
   sideways drag could be asking it for, and claiming those is what turned a
   thumb sliding 16px on a number-pad key into a press that did nothing at all. */
const DRAG_AT = 10
/** Once it is following the finger, pushing back up past the detent barely gives. */
const UP_GIVE = 0.06

/* ============================================================================
   Presentation plumbing.

   UIKit gives a presented view controller four things for free that a portalled
   div does not: what's behind it stops scrolling, stops taking taps and stops
   existing for VoiceOver; focus moves in and comes back out; Tab cannot walk
   out of it; and Escape (a hardware keyboard's swipe-down) dismisses it.

   The first of those belongs to `SheetPortal`, because every overlay in the app
   goes through that layer and not every overlay is a sheet. The other three are
   here, keyed to the overlay's own element.
   ========================================================================== */

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

/* ============================================================================
   Pull-to-dismiss.

   The sheet follows the finger from anywhere on it, and framer's own `drag`
   could not do that. It sits on the sheet, and the browser hands any vertical
   touch that starts inside the scrolling body to the scroll container — and
   cancels the pointer — long before the drag sees it, so the only way to put a
   sheet away with a finger was its 73px header. It
   also stamped `touch-action: pan-x` across the whole sheet, and the browser
   cancels a pointer the moment it decides a touch is a pan: a key pressed with
   a thumb's worth of travel lit up and then did nothing at all.

   So the sheet recognises its own pull. It watches the pointer and takes it
   over only once the finger has committed to a drag the content under it cannot
   answer — a scroll view already at its top, or one with nothing to scroll,
   which is what iOS does. Under that threshold it claims nothing, which is what
   leaves a press a press.
   ========================================================================== */

/** The scroll view the finger landed in, if any, looking no further than the sheet. */
function scrollerUnder(from: Element | null, within: Element): HTMLElement | null {
  let el = from
  while (el && el !== within) {
    if (el instanceof HTMLElement) {
      const overflow = getComputedStyle(el).overflowY
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        return el
      }
    }
    el = el.parentElement
  }
  return null
}

function useSheetDrag(onDismiss: () => void, ref: RefObject<HTMLElement>) {
  const y = useMotionValue<number | string>(0)
  const pointer = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const sheet = ref.current
    if (!sheet || !e.isPrimary || pointer.current !== null) return
    const id = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    const scroller = scrollerUnder(e.target as Element, sheet)
    let decided = false
    let owned = false
    let engaged = false
    pointer.current = id
    // Enough of a trail to read the speed of the release: a sheet flicked down
    // an inch goes away, the way one flicked an inch does on iOS.
    const trail: { y: number; t: number }[] = [{ y: startY, t: performance.now() }]

    const speed = () => {
      const last = trail.at(-1)!
      const from = trail.find((s) => last.t - s.t < 90) ?? trail[0]!
      const dt = last.t - from.t
      if (dt < 1) return 0
      return ((last.y - from.y) / dt) * 1000
    }

    const cleanup = () => {
      pointer.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', block)
    }

    /* Said on the first move of the sequence, which is the last one the browser
       is still willing to have cancelled. */
    function block(ev: TouchEvent) {
      if (owned && ev.cancelable) ev.preventDefault()
    }

    /** Whether this gesture belongs to the sheet or to the content under it. */
    function decide(dy: number) {
      decided = true
      // Nothing under the finger scrolls, so no touch here is a scroll.
      if (!scroller) return (owned = true)
      // A scroll view already at its top hands a downward pull to the sheet.
      if (dy > 0 && scroller.scrollTop <= 0) return (owned = true)
      cleanup()
      return false
    }

    function move(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      const dy = ev.clientY - startY
      if (!decided) {
        if (Math.abs(dy) < 2 && Math.abs(ev.clientX - startX) < 2) return
        if (!decide(dy)) return
      }
      trail.push({ y: ev.clientY, t: performance.now() })
      if (trail.length > 8) trail.shift()
      if (!engaged) {
        if (dy < DRAG_AT) return
        const el = ref.current
        if (!el) return cleanup()
        engaged = true
        // The finger is moving the sheet now, so it is no longer pressing
        // whatever it landed on, and the release must not fire it either.
        cancelPress()
        el.setPointerCapture(id)
        const swallow = (click: Event) => {
          click.preventDefault()
          click.stopPropagation()
        }
        el.addEventListener('click', swallow, { capture: true, once: true })
        // Nothing arrived to swallow, so the guard must not outlive the gesture.
        setTimeout(() => el.removeEventListener('click', swallow, true), 0)
      }
      y.set(dy > 0 ? dy : dy * UP_GIVE)
    }

    function up(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      cleanup()
      if (!engaged) return
      // Where the drag was heading, not only where it stopped — the same
      // projection a scroll view decelerates with. Dismissing leaves the sheet
      // exactly where the finger left it, so the exit carries on from there.
      if (ev.clientY - startY + speed() * 0.2 > DISMISS_AT) onDismiss()
      else animate(y, 0, SHEET_SETTLE)
    }

    function cancel(ev: PointerEvent) {
      if (ev.pointerId !== id) return
      cleanup()
      if (engaged) animate(y, 0, SHEET_SETTLE)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchmove', block, { passive: false })
  }

  return { y, onPointerDown }
}

/**
 * Focus, Tab and Escape, keyed to the overlay's own element. Exported because a
 * full-screen overlay that is not a sheet — the photo viewer — owes the client
 * exactly the same contract, and had grown its own copy of it. The fourth part,
 * freezing the app behind, comes with `SheetPortal`.
 */
export function usePresentation(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)
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
  const drag = useSheetDrag(onClose, ref)
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
              y: drag.y,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_TRANSITION}
            onPointerDownCapture={drag.onPointerDown}
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
              transition={{ ...ALERT_ARRIVE, opacity: SHEET_TRANSITION }}
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
