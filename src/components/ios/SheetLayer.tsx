import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { create } from 'zustand'

/* ============================================================================
   Sheet layer.

   iOS presents a sheet by pushing the presenting screen back into the display:
   it scales down, gains rounded corners and dims. Reproducing that means the
   sheet cannot live inside the thing being scaled, so every overlay renders
   into this layer instead and a depth counter tells the app when to recede.
   ========================================================================== */

interface SheetLayerState {
  /** How many receding overlays are currently open. */
  depth: number
  /** The portal target, published so mounted portals re-render once it exists. */
  element: HTMLElement | null
  push: () => void
  pop: () => void
  setElement: (el: HTMLElement | null) => void
}

export const useSheetLayer = create<SheetLayerState>((set) => ({
  depth: 0,
  element: null,
  push: () => set((s) => ({ depth: s.depth + 1 })),
  pop: () => set((s) => ({ depth: Math.max(0, s.depth - 1) })),
  setElement: (element) => set({ element }),
}))

export const registerSheetLayer = (el: HTMLElement | null) =>
  useSheetLayer.getState().setElement(el)

/* ---------------------------- freezing the app ---------------------------- */

/**
 * What UIKit gives a presented view controller for free and a portalled div
 * does not: the app behind it stops scrolling, stops taking taps, and stops
 * existing for VoiceOver.
 *
 * It lives here rather than in Sheet.tsx because *every* overlay comes through
 * this layer, and only some of them are sheets. The photo viewer is not, so it
 * took none of this: a screen reader could still walk the whole of Today
 * underneath a full-screen photograph, and it had no way to say otherwise
 * without reaching into an element another module owned. Counted, because a
 * sheet can present another one over it.
 */
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

/**
 * Portals overlay content into the sheet layer, freezes the app behind it, and
 * — while `recede` is set — counts toward pushing that app back into the
 * display. Receding is the sheet's own look; the freeze is every overlay's.
 */
export function SheetPortal({
  children,
  active,
  recede = true,
}: {
  children: ReactNode
  active: boolean
  recede?: boolean
}) {
  const target = useSheetLayer((s) => s.element)
  const push = useSheetLayer((s) => s.push)
  const pop = useSheetLayer((s) => s.pop)

  useEffect(() => {
    if (!active) return
    overlays += 1
    applyOverlayLock()
    return () => {
      overlays -= 1
      applyOverlayLock()
    }
  }, [active])

  useEffect(() => {
    if (!active || !recede) return
    push()
    return pop
  }, [active, recede, push, pop])

  // Until the layer exists, render in place rather than disappearing.
  if (!target) return <>{children}</>
  return createPortal(children, target)
}
