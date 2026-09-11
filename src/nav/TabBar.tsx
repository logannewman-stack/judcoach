import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNav, TABS } from './nav'
import type { TabKey } from './nav'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'

/* Every domain owns a colour (DESIGN.md §2) and the tab bar is where all five
   are visible at once, so each tab names its own rather than inheriting --tint
   from whichever screen happens to be in front. The fifth tab is Jud: his
   thread, his programme, his cues, so it takes the Coach hue. */
const TAB_META: Record<TabKey, { label: string; icon: IconName; active: IconName; tint: string }> = {
  today: { label: 'Today', icon: 'home', active: 'home.fill', tint: 'var(--tint-today)' },
  train: { label: 'Train', icon: 'dumbbell', active: 'dumbbell.fill', tint: 'var(--tint-train)' },
  meals: { label: 'Meals', icon: 'fork', active: 'fork.fill', tint: 'var(--tint-meals)' },
  weigh: { label: 'Weigh-In', icon: 'scale', active: 'scale.fill', tint: 'var(--tint-weigh)' },
  settings: { label: 'Settings', icon: 'gear', active: 'gear.fill', tint: 'var(--tint-coach)' },
}

/* The capsule is one element that moves between tabs rather than five that fade
   in and out, so switching tab reads as the selection travelling. Stiff and
   lightly damped: it should arrive a touch past its mark and settle. */
const GLIDE = { type: 'spring', stiffness: 460, damping: 34, mass: 0.7 } as const
const POP = { type: 'spring', stiffness: 520, damping: 17, mass: 0.6 } as const

export function TabBar({ badges }: { badges?: Partial<Record<TabKey, number>> }) {
  const tab = useNav((s) => s.tab)
  const switchTab = useNav((s) => s.switchTab)

  /* The tab bar is the one thing that knows which domain is in front of you, so
     it is what tells the document — and base.css resolves --tint from there.
     Every screen, sheet and control below then gets its section's hue without a
     single call site naming a colour. */
  useEffect(() => {
    document.documentElement.dataset.domain = tab
  }, [tab])

  return (
    <nav className="tabbar" role="tablist" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.map((key) => {
          const meta = TAB_META[key]
          const isActive = tab === key
          const badge = badges?.[key]
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={meta.label}
              className="tab"
              data-active={isActive}
              onClick={() => switchTab(key)}
              style={{ ['--tint' as string]: meta.tint }}
            >
              <span className="tab-icon">
                {isActive && (
                  <motion.span
                    className="tab-blob"
                    layoutId="tab-blob"
                    transition={GLIDE}
                  />
                )}
                {/* Remounting on selection replays the spring, so the icon pops
                    when you pick the tab and stays still otherwise. */}
                <motion.span
                  key={isActive ? 'on' : 'off'}
                  className="tab-glyph"
                  initial={isActive ? { scale: 0.72 } : false}
                  animate={{ scale: 1 }}
                  transition={POP}
                >
                  <Icon name={isActive ? meta.active : meta.icon} size={24} weight={1.9} />
                </motion.span>
                {badge ? <span className="tab-badge">{badge > 9 ? '9+' : badge}</span> : null}
              </span>
              <span className="tab-label">{meta.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
