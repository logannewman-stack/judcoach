/**
 * Immediate press states.
 *
 * A browser holds `:active` back on touch until its gesture recogniser has
 * ruled out a scroll. Measured on a list row here, the highlight arrived 250ms
 * after touch-down — 30ms *after* the finger had already lifted, so a press
 * acknowledged nothing until it was over. UIKit highlights on touch-down, drops
 * the highlight the moment the touch leaves the control, brings it back if the
 * touch returns, and abandons it outright once a scroll view takes the gesture
 * over. That is what this does, writing `data-pressed` for CSS to key off
 * instead of `:active`.
 */

const PRESSABLE = 'button, [role="button"], a[href], [data-pressable="true"]'

let pressed: HTMLElement | null = null
let bounds: DOMRect | null = null
let pointerId = -1
let inside = false

function paint(on: boolean) {
  if (!pressed || on === inside) return
  inside = on
  if (on) pressed.dataset.pressed = ''
  else delete pressed.dataset.pressed
}

/** Ends the press: a drag or a scroll has taken the gesture over. */
export function cancelPress(): void {
  paint(false)
  pressed = null
  bounds = null
  pointerId = -1
}

function expand(r: DOMRect, min: number): DOMRect {
  const x = Math.min(0, (r.width - min) / 2)
  const y = Math.min(0, (r.height - min) / 2)
  return new DOMRect(r.x + x, r.y + y, r.width - x * 2, r.height - y * 2)
}

function onPointerDown(e: PointerEvent) {
  cancelPress()
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
  const target = (e.target as Element | null)?.closest(PRESSABLE) as HTMLElement | null
  if (!target || target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true') return
  pressed = target
  // Cached rather than re-read per move: a scroll cancels the press anyway, so
  // the rectangle cannot go stale under the finger. Widened to Apple's 44pt
  // minimum, because a control smaller than that is being hit through the
  // padding `.hit-expand` gives it and should cancel at that edge, not its own.
  bounds = expand(target.getBoundingClientRect(), 44)
  pointerId = e.pointerId
  paint(true)
}

function onPointerMove(e: PointerEvent) {
  if (!pressed || !bounds || e.pointerId !== pointerId) return
  paint(
    e.clientX >= bounds.left && e.clientX <= bounds.right &&
    e.clientY >= bounds.top && e.clientY <= bounds.bottom,
  )
}

/* Space and Enter are how a keyboard presses a button, and `:active` used to
   show it. Held keys repeat, so only the first counts. */
function onKeyDown(e: KeyboardEvent) {
  if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
  const target = document.activeElement as HTMLElement | null
  if (!target || !target.matches(PRESSABLE) || target.matches(':disabled')) return
  cancelPress()
  pressed = target
  bounds = null
  paint(true)
}

/**
 * Starts driving press states off pointer events. Returns a teardown, though in
 * practice the app owns the document for its whole life.
 */
export function installPressStates(): () => void {
  const doc = document
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('pointermove', onPointerMove, true)
  doc.addEventListener('pointerup', cancelPress, true)
  doc.addEventListener('pointercancel', cancelPress, true)
  doc.addEventListener('contextmenu', cancelPress, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('keyup', cancelPress, true)
  // Capture, so a scroll anywhere inside the app counts, not only on the page.
  doc.addEventListener('scroll', cancelPress, true)
  window.addEventListener('blur', cancelPress)

  return () => {
    cancelPress()
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('pointermove', onPointerMove, true)
    doc.removeEventListener('pointerup', cancelPress, true)
    doc.removeEventListener('pointercancel', cancelPress, true)
    doc.removeEventListener('contextmenu', cancelPress, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('keyup', cancelPress, true)
    doc.removeEventListener('scroll', cancelPress, true)
    window.removeEventListener('blur', cancelPress)
  }
}
