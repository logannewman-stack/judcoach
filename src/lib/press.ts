/**
 * Immediate press states, and the taps the browser walks away from.
 *
 * A browser holds `:active` back on touch until its gesture recogniser has
 * ruled out a scroll. Measured on a list row here, the highlight arrived 250ms
 * after touch-down — 30ms *after* the finger had already lifted, so a press
 * acknowledged nothing until it was over. UIKit highlights on touch-down, drops
 * the highlight the moment the touch leaves the control, brings it back if the
 * touch returns, and abandons it outright once a scroll view takes the gesture
 * over. That is what this does, writing `data-pressed` for CSS to key off
 * instead of `:active`.
 *
 * It also has to finish the taps the browser drops. `click` is synthesised from
 * the primary pointer only, and not at all once a second finger is on the glass:
 * measured with real multi-touch, a tap on a settings row with a palm resting on
 * the title produced a pointerup on the row and no click, and a second finger
 * landing mid-tap killed the click the first finger had already earned. Every
 * control in this app activates on `onClick`, so a steadying thumb left the
 * whole app dead to the touch — and a bare `<button>` with no application code
 * behaves the same way, so there is nothing to fix in CSS or at the call sites.
 * UIKit hands a touch to the control under it whether or not another finger is
 * down, so a press the browser abandoned is completed here instead.
 *
 * Presses are therefore kept per pointer rather than one at a time: a palm is a
 * pointer too, and it must neither steal the highlight from the finger doing the
 * tapping nor wipe it on the way down.
 */

const PRESSABLE = 'button, [role="button"], a[href], [data-pressable="true"]'

interface Press {
  target: HTMLElement
  /** Null for a keyboard press, which has no geometry to wander out of. */
  bounds: DOMRect | null
  inside: boolean
  /** Only a touch is ever owed a click; a mouse always gets its own. */
  touch: boolean
}

const presses = new Map<number, Press>()
/** The keyboard holds at most one press, under an id no pointer can take. */
const KEY_PRESS = -1

/** Taps waiting to see whether the browser means to complete them. */
const owed = new Map<number, HTMLElement>()
let nextTap = 0

/** Whether any other live press still holds this element down. */
function held(target: HTMLElement): boolean {
  for (const press of presses.values()) if (press.target === target && press.inside) return true
  return false
}

function paint(press: Press, on: boolean) {
  if (on === press.inside) return
  press.inside = on
  if (on) press.target.dataset.pressed = ''
  else if (!held(press.target)) delete press.target.dataset.pressed
}

/** Drops one press and reports whether the pointer was still on its control. */
function release(id: number): boolean {
  const press = presses.get(id)
  if (!press) return false
  const landed = press.inside
  paint(press, false)
  presses.delete(id)
  return landed
}

/** Ends every press: a drag or a scroll has taken the gesture over. */
export function cancelPress(): void {
  for (const id of [...presses.keys()]) release(id)
  owed.clear()
}

function expand(r: DOMRect, min: number): DOMRect {
  const x = Math.min(0, (r.width - min) / 2)
  const y = Math.min(0, (r.height - min) / 2)
  return new DOMRect(r.x + x, r.y + y, r.width - x * 2, r.height - y * 2)
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // This pointer's own stale press, and the keyboard's — but not another
  // finger's, which is still holding its control down.
  release(e.pointerId)
  release(KEY_PRESS)
  const target = (e.target as Element | null)?.closest(PRESSABLE) as HTMLElement | null
  if (!target || target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true') return
  // Cached rather than re-read per move: a scroll cancels the press anyway, so
  // the rectangle cannot go stale under the finger. Widened to Apple's 44pt
  // minimum, because a control smaller than that is being hit through the
  // padding `.hit-expand` gives it and should cancel at that edge, not its own.
  const press: Press = {
    target,
    bounds: expand(target.getBoundingClientRect(), 44),
    inside: false,
    touch: e.pointerType !== 'mouse',
  }
  presses.set(e.pointerId, press)
  paint(press, true)
}

function onPointerMove(e: PointerEvent) {
  const press = presses.get(e.pointerId)
  if (!press?.bounds) return
  paint(
    press,
    e.clientX >= press.bounds.left && e.clientX <= press.bounds.right &&
    e.clientY >= press.bounds.top && e.clientY <= press.bounds.bottom,
  )
}

function onPointerUp(e: PointerEvent) {
  const press = presses.get(e.pointerId)
  const landed = release(e.pointerId)
  // Lifting somewhere other than the control is a cancel, not a tap.
  if (press && landed && press.touch) complete(press.target)
}

function onPointerCancel(e: PointerEvent) {
  release(e.pointerId)
}

/**
 * Finish a tap, unless the browser is about to.
 *
 * A real click lands after this pointerup's microtasks and before the next
 * timer — measured in this order: pointerup, microtasks, click, animation
 * frame, timers. So one task later is late enough to know none is coming and
 * far too early for anyone to see the wait.
 */
function complete(target: HTMLElement) {
  const tap = nextTap++
  owed.set(tap, target)
  setTimeout(() => {
    const el = owed.get(tap)
    owed.delete(tap)
    if (el?.isConnected) el.click()
  }, 0)
}

/* The browser got there first, so nothing is owed. A click reports the deepest
   element it hit, which is the pressed control or something inside it. */
function onClick(e: Event) {
  const hit = e.target as Node | null
  if (!hit || owed.size === 0) return
  for (const [tap, el] of owed) if (el === hit || el.contains(hit)) owed.delete(tap)
}

/* Space and Enter are how a keyboard presses a button, and `:active` used to
   show it. Held keys repeat, so only the first counts. */
function onKeyDown(e: KeyboardEvent) {
  if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
  const target = document.activeElement as HTMLElement | null
  if (!target || !target.matches(PRESSABLE) || target.matches(':disabled')) return
  release(KEY_PRESS)
  const press: Press = { target, bounds: null, inside: false, touch: false }
  presses.set(KEY_PRESS, press)
  paint(press, true)
}

function onKeyUp() {
  release(KEY_PRESS)
}

/**
 * Starts driving press states off pointer events. Returns a teardown, though in
 * practice the app owns the document for its whole life.
 */
export function installPressStates(): () => void {
  const doc = document
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('pointermove', onPointerMove, true)
  doc.addEventListener('pointerup', onPointerUp, true)
  doc.addEventListener('pointercancel', onPointerCancel, true)
  doc.addEventListener('click', onClick, true)
  doc.addEventListener('contextmenu', cancelPress, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('keyup', onKeyUp, true)
  // Capture, so a scroll anywhere inside the app counts, not only on the page.
  doc.addEventListener('scroll', cancelPress, true)
  window.addEventListener('blur', cancelPress)

  return () => {
    cancelPress()
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('pointermove', onPointerMove, true)
    doc.removeEventListener('pointerup', onPointerUp, true)
    doc.removeEventListener('pointercancel', onPointerCancel, true)
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('contextmenu', cancelPress, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('keyup', onKeyUp, true)
    doc.removeEventListener('scroll', cancelPress, true)
    window.removeEventListener('blur', cancelPress)
  }
}
