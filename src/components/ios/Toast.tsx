import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

interface ToastState {
  message: string | null
  icon: IconName
  tone: 'default' | 'good' | 'bad'
  token: number
  show: (message: string, opts?: { icon?: IconName; tone?: 'default' | 'good' | 'bad' }) => void
  hide: () => void
}

let timer: number | undefined

export const useToast = create<ToastState>((set) => ({
  message: null,
  icon: 'check.circle.fill',
  tone: 'default',
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
export const toast = (message: string, opts?: { icon?: IconName; tone?: 'default' | 'good' | 'bad' }) =>
  useToast.getState().show(message, opts)

const TONE_COLOR = {
  default: 'var(--accent)',
  good: 'var(--green)',
  bad: 'var(--red)',
} as const

export function ToastHost() {
  const { message, icon, tone, token } = useToast()
  return (
    <div className="toast-host">
      <AnimatePresence>
        {message && (
          <motion.div
            key={token}
            className="toast"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <Icon name={icon} size={20} color={TONE_COLOR[tone]} />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
