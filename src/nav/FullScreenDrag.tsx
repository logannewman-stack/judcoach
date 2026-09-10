import { createContext, useContext } from 'react'
import type { DragControls } from 'framer-motion'

/**
 * Lets a presented full-screen screen hand its own header to the modal's drag
 * gesture, so pulling down on the toolbar dismisses it the way iOS does —
 * without the scroll view stealing the gesture.
 */
export const FullScreenDragContext = createContext<DragControls | null>(null)

export const useFullScreenDrag = () => useContext(FullScreenDragContext)
