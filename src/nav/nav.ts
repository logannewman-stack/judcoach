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
  /** Bumped when the active tab is re-tapped at its root. */
  scrollTopTick: number
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
  scrollTopTick: 0,

  switchTab: (tab) => {
    const { tab: current, stacks, scrollTopTick } = get()
    if (current === tab) {
      // Tapping the active tab pops its stack to root, then scrolls to the top
      // on a second tap — exactly like iOS. Through popToRoot rather than a
      // second copy of it: the two had drifted into being the same four lines
      // written twice, and only one of them ever got read.
      if (stacks[tab].length > 1) {
        get().popToRoot()
      } else {
        set({ scrollTopTick: scrollTopTick + 1 })
      }
      return
    }
    // Only an actual change of tab is a selection; tapping the one you are
    // already on pops or scrolls, and iOS says nothing about either.
    haptic('selection')
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

  /* Everything between the root and the top goes at once. Stack renders the top
     two screens, so the one parked behind would otherwise become a second exit
     animation and slide off in convoy across the root it is uncovering; it is
     removed without animation there instead, the way UINavigationController
     removes the view controllers under the one it animates off. */
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
