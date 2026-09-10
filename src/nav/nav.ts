import { create } from 'zustand'
import { haptic } from '../lib/haptics'

export type TabKey = 'today' | 'train' | 'meals' | 'weigh' | 'settings'

export const TABS: TabKey[] = ['today', 'train', 'meals', 'weigh', 'settings']

export interface Route {
  /** Screen registry key. */
  key: string
  params?: Record<string, unknown>
  /** Stable identity for animation keys. */
  id: string
}

let seq = 0
const route = (key: string, params?: Record<string, unknown>): Route => ({
  key,
  params,
  id: `${key}#${++seq}`,
})

interface NavState {
  tab: TabKey
  stacks: Record<TabKey, Route[]>
  /** Presented over everything — the live workout runner. */
  fullScreen: Route | null
  switchTab: (tab: TabKey) => void
  push: (key: string, params?: Record<string, unknown>) => void
  pop: () => void
  popToRoot: () => void
  present: (key: string, params?: Record<string, unknown>) => void
  dismiss: () => void
}

const ROOTS: Record<TabKey, Route> = {
  today: route('today'),
  train: route('train'),
  meals: route('meals'),
  weigh: route('weigh'),
  settings: route('settings'),
}

export const useNav = create<NavState>((set, get) => ({
  tab: 'today',
  stacks: {
    today: [ROOTS.today],
    train: [ROOTS.train],
    meals: [ROOTS.meals],
    weigh: [ROOTS.weigh],
    settings: [ROOTS.settings],
  },
  fullScreen: null,

  switchTab: (tab) => {
    const { tab: current, stacks } = get()
    haptic('selection')
    // Tapping the active tab pops its stack to root, exactly like iOS.
    if (current === tab && stacks[tab].length > 1) {
      set({ stacks: { ...stacks, [tab]: [stacks[tab][0]!] } })
      return
    }
    set({ tab })
  },

  push: (key, params) => {
    const { tab, stacks } = get()
    set({ stacks: { ...stacks, [tab]: [...stacks[tab], route(key, params)] } })
  },

  pop: () => {
    const { tab, stacks } = get()
    if (stacks[tab].length <= 1) return
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, -1) } })
  },

  popToRoot: () => {
    const { tab, stacks } = get()
    set({ stacks: { ...stacks, [tab]: [stacks[tab][0]!] } })
  },

  present: (key, params) => set({ fullScreen: route(key, params) }),
  dismiss: () => set({ fullScreen: null }),
}))

/** Convenience accessors for callers that aren't components. */
export const navPush = (key: string, params?: Record<string, unknown>) => useNav.getState().push(key, params)
export const navPop = () => useNav.getState().pop()
export const navPresent = (key: string, params?: Record<string, unknown>) => useNav.getState().present(key, params)
export const navDismiss = () => useNav.getState().dismiss()
export const navSwitchTab = (tab: TabKey) => useNav.getState().switchTab(tab)
