import { useEffect, useState } from 'react'

/* ============================================================================
   How much of the screen the on-screen keyboard is covering.

   iOS does not change `window.innerHeight` when the keyboard opens — the layout
   viewport stays the same size and the keyboard is drawn over it. Anything
   pinned to the bottom of the app, the message composer most of all, ends up
   behind it. `visualViewport` is the only thing that reports the real height.
   ========================================================================== */

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let frame: number | undefined
    const measure = () => {
      frame = undefined
      // offsetTop covers the case where the page itself has been scrolled up to
      // keep the focused field visible; without it the inset double-counts.
      const covered = window.innerHeight - vv.height - vv.offsetTop
      // Below about 80 it is a URL bar collapsing, not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0)
    }
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(measure)
    }

    measure()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    return () => {
      if (frame != null) cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
    }
  }, [])

  return inset
}
