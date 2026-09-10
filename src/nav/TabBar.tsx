import { useNav, TABS } from './nav'
import type { TabKey } from './nav'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'

const TAB_META: Record<TabKey, { label: string; icon: IconName; active: IconName }> = {
  today: { label: 'Today', icon: 'home', active: 'home.fill' },
  train: { label: 'Train', icon: 'dumbbell', active: 'dumbbell.fill' },
  meals: { label: 'Meals', icon: 'fork', active: 'fork.fill' },
  weigh: { label: 'Weigh-In', icon: 'scale', active: 'scale.fill' },
  settings: { label: 'Settings', icon: 'gear', active: 'gear.fill' },
}

export function TabBar({ badges }: { badges?: Partial<Record<TabKey, number>> }) {
  const tab = useNav((s) => s.tab)
  const switchTab = useNav((s) => s.switchTab)

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
            >
              <Icon name={isActive ? meta.active : meta.icon} size={26} weight={1.7} />
              <span className="tab-label">{meta.label}</span>
              {badge ? <span className="tab-badge">{badge > 9 ? '9+' : badge}</span> : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
