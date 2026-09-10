import { AnimatePresence, motion } from 'framer-motion'
import { Stack } from './nav/Stack'
import { TabBar } from './nav/TabBar'
import { TABS, useNav } from './nav/nav'
import { SCREENS } from './screens/registry'
import { ToastHost } from './components/ios/Toast'
import { RestTimerBar } from './components/RestTimer'
import { useTheme, useWakeLock } from './lib/useTheme'
import { useStore } from './store/useStore'
import { DeviceFrame } from './components/DeviceFrame'

export function App() {
  useTheme()
  const tab = useNav((s) => s.tab)
  const fullScreen = useNav((s) => s.fullScreen)
  const active = useStore((s) => s.active)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  useWakeLock(keepAwake && !!active)

  const FullScreenComponent = fullScreen ? SCREENS[fullScreen.key] : null

  return (
    <DeviceFrame>
      <div className="app">
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {TABS.map((key) => (
          <Stack key={key} tab={key} registry={SCREENS} active={tab === key} />
        ))}
        {/* Sits above the tab bar so it survives a wander between tabs. */}
        <RestTimerBar bottomOffset={10} />
      </div>

      <TabBar />

      <AnimatePresence>
        {fullScreen && FullScreenComponent && (
          <motion.div
            key={fullScreen.id}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--grouped)' }}
          >
            <FullScreenComponent {...(fullScreen.params ?? {})} />
          </motion.div>
        )}
      </AnimatePresence>

      <ToastHost />
      </div>
    </DeviceFrame>
  )
}
