import { useEffect, useState } from 'react'

/**
 * Height of the on-screen keyboard, in CSS pixels.
 *
 * iOS Safari doesn't resize the layout viewport when the keyboard opens, so a
 * bottom-anchored sheet ends up underneath it. visualViewport is the only thing
 * that reports the real occluded height.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const occluded = window.innerHeight - vv.height - vv.offsetTop
      // Small deltas are toolbar chrome, not a keyboard.
      setInset(occluded > 90 ? Math.round(occluded) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
