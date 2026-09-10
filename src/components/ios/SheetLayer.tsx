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

/**
 * Portals overlay content into the sheet layer and, while `recede` is set,
 * counts toward pushing the app back.
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
    if (!active || !recede) return
    push()
    return pop
  }, [active, recede, push, pop])

  // Until the layer exists, render in place rather than disappearing.
  if (!target) return <>{children}</>
  return createPortal(children, target)
}
