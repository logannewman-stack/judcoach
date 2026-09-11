import { useLayoutEffect, useState } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

type Tone = 'default' | 'good' | 'bad'

interface ToastState {
  message: string | null
  icon: IconName
  tone: Tone
  token: number
  show: (message: string, opts?: { icon?: IconName; tone?: Tone }) => void
  hide: () => void
}

let timer: number | undefined

export const useToast = create<ToastState>((set) => ({
  message: null,
  icon: 'check.circle.fill',
  tone: 'default' as Tone,
  token: 0,
  show: (message, opts) => {
    set((s) => ({
      message,
      icon: opts?.icon ?? 'check.circle.fill',
      tone: opts?.tone ?? 'default',
      token: s.token + 1,
    }))
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => set({ message: null }), 2100)
  },
  hide: () => set({ message: null }),
}))

/** Fire-and-forget helper so callers don't need the hook. */
export const toast = (message: string, opts?: { icon?: IconName; tone?: Tone }) =>
  useToast.getState().show(message, opts)

const TONE_COLOR = {
  default: 'var(--accent)',
  good: 'var(--green)',
  bad: 'var(--red)',
} as const

export function ToastHost() {
  const { message, icon, tone, token } = useToast()
  const [top, setTop] = useState<number | null>(null)

  /* The host hangs off the top of the window, but the app does not always start
     there — the coach seat bar takes the notch and pushes everything down, and a
     toast pinned to the window landed on top of it. When something is above the
     screen it has already paid for the safe area, so hang off its bottom edge;
     otherwise leave the CSS, which pads for the notch itself, alone. */
  useLayoutEffect(() => {
    if (!message) return
    const screen = document.querySelector<HTMLElement>('[data-stack-active="true"]')
    const app = document.querySelector<HTMLElement>('.app')
    if (!screen || !app) return
    const offset = screen.getBoundingClientRect().top - app.getBoundingClientRect().top
    setTop(offset > 0 ? offset + 6 : null)
  }, [message, token])

  /* A toast is the app's only spoken confirmation that something happened — a
     set logged, a weigh-in saved, a disk that is full — and it was silent. A
     live region has to be in the document *before* its text changes or nothing
     is announced, so both of these are always mounted and always empty; the
     visible toast is rendered separately and hidden from the reader, because one
     element cannot be both a live region and an animated, remounting child.

     Two regions rather than one with a swapped role: assertive interrupts what
     the client is listening to, which is right for a failure and wrong for
     "Saved", and a role swapped on a live node does not reliably re-announce. */
  const assertive = tone === 'bad'

  return (
    <div className="toast-host" style={top == null ? undefined : { top }}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message && !assertive ? message : ''}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {message && assertive ? message : ''}
      </div>
      {/* popLayout, so a toast arriving while one is leaving takes its place
          rather than being shouldered sideways by it. */}
      <AnimatePresence mode="popLayout">
        {message && (
          <motion.div
            key={token}
            className="toast"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            aria-hidden="true"
          >
            <Icon name={icon} size={20} color={TONE_COLOR[tone]} />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
