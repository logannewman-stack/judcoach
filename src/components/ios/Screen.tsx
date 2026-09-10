import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import { useNav } from '../../nav/nav'
import { ROUTE_TITLES } from '../../screens/registry'

/* ============================================================================
   Screen chrome: a translucent nav bar whose inline title fades in exactly as
   the large title scrolls away, the way UIKit does it.
   ========================================================================== */

export interface NavAction {
  label?: string
  icon?: Parameters<typeof Icon>[0]['name']
  onPress: () => void
  strong?: boolean
  disabled?: boolean
  ariaLabel?: string
}

interface ScreenProps {
  title: string
  /** Renders the iOS large title inside the scroll view. */
  largeTitle?: boolean
  /**
   * Pins the small title in the bar instead of fading it in on scroll. Only for
   * screens that render no large title of their own.
   */
  inlineTitle?: boolean
  /** Sits under the large title — a subtitle, segmented control, etc. */
  titleAccessory?: ReactNode
  /** Omit `label` to name the screen you actually came from. */
  back?: { label?: string; onPress: () => void }
  left?: NavAction
  right?: NavAction | NavAction[]
  children: ReactNode
  /** Pinned above the tab bar, e.g. a primary action. */
  footer?: ReactNode
  /** Extra bottom padding so content clears the tab bar. */
  padBottom?: boolean
  scrollRef?: React.RefObject<HTMLDivElement>
}

function NavButton({ action }: { action: NavAction }) {
  return (
    <button
      className={`nav-btn${action.strong ? ' strong' : ''}`}
      onClick={action.onPress}
      disabled={action.disabled}
      aria-label={action.ariaLabel ?? action.label}
      type="button"
    >
      {action.icon && <Icon name={action.icon} size={21} weight={2} />}
      {action.label}
    </button>
  )
}

/** The previous route's short title, so Back always names where it goes. */
function useBackLabel(explicit?: string): string {
  const tab = useNav((s) => s.tab)
  const stack = useNav((s) => s.stacks[s.tab])
  if (explicit) return explicit
  const previous = stack[stack.length - 2]
  if (!previous) return ROUTE_TITLES[tab] ?? 'Back'
  return ROUTE_TITLES[previous.key] ?? 'Back'
}

export function Screen({
  title,
  largeTitle = true,
  inlineTitle = false,
  titleAccessory,
  back,
  left,
  right,
  children,
  footer,
  padBottom = true,
  scrollRef,
}: ScreenProps) {
  const [scrolled, setScrolled] = useState(false)
  const ticking = useRef(false)

  // Threshold flip only — the fade itself is a CSS transition, so scrolling
  // never triggers a render storm.
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (ticking.current) return
    ticking.current = true
    const top = e.currentTarget.scrollTop
    requestAnimationFrame(() => {
      setScrolled((prev) => {
        // The large-title block is ~53px tall; flipping at 32 crossfaded the
        // inline title while the last of it was still sliding under the bar.
        const next = top > (largeTitle ? 46 : 4)
        return prev === next ? prev : next
      })
      ticking.current = false
    })
  }, [largeTitle])

  const rights = right ? (Array.isArray(right) ? right : [right]) : []
  const backLabel = useBackLabel(back?.label)

  return (
    <div className="screen">
      <div className="navbar" data-scrolled={scrolled} data-inline={inlineTitle}>
        <div className="navbar-inner">
          <div className="navbar-side">
            {back ? (
              <button className="nav-btn" onClick={back.onPress} type="button" aria-label="Back">
                <Icon name="chevron.left" size={20} weight={2.6} />
                {backLabel}
              </button>
            ) : left ? (
              <NavButton action={left} />
            ) : null}
          </div>
          <div className="navbar-title">{title}</div>
          <div className="navbar-side right">
            {rights.map((a, i) => (
              <NavButton key={i} action={a} />
            ))}
          </div>
        </div>
      </div>

      <div className="scroll" onScroll={onScroll} ref={scrollRef}>
        {largeTitle && (
          <div className="large-title-block">
            <h1 className="t-large-title">{title}</h1>
          </div>
        )}
        {titleAccessory}
        {children}
        {padBottom && <div className="scroll-pad-bottom" />}
      </div>

      {footer && <div className="screen-footer">{footer}</div>}
    </div>
  )
}
