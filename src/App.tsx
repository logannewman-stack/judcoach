import { useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Stack } from './nav/Stack'
import { TabBar } from './nav/TabBar'
import { TABS, useNav } from './nav/nav'
import { SCREENS } from './screens/registry'
import { ToastHost } from './components/ios/Toast'
import { registerSheetLayer, useSheetLayer } from './components/ios/SheetLayer'
import { RestTimerBar } from './components/RestTimer'
import { DeviceFrame } from './components/DeviceFrame'
import { Onboarding } from './screens/Onboarding'
import { useTheme, useWakeLock } from './lib/useTheme'
import { useStore } from './store/useStore'

export function App() {
  useTheme()
  const tab = useNav((s) => s.tab)
  const fullScreen = useNav((s) => s.fullScreen)
  const active = useStore((s) => s.active)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  const onboarded = useStore((s) => s.onboarded)
  const scrollTopTick = useNav((s) => s.scrollTopTick)
  const sheetDepth = useSheetLayer((s) => s.depth)
  const sheetLayer = useRef<HTMLDivElement>(null)
  useWakeLock(keepAwake && !!active)

  // Overlays portal here, so the app itself can be pushed back behind them.
  useEffect(() => {
    registerSheetLayer(sheetLayer.current)
    return () => registerSheetLayer(null)
  }, [])

  // iOS scrolls a tab to the top when you tap it while already there.
  useEffect(() => {
    if (scrollTopTick === 0) return
    document
      .querySelector<HTMLElement>('[data-stack-active="true"] .scroll')
      ?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [scrollTopTick])

  const FullScreenComponent = fullScreen ? SCREENS[fullScreen.key] : null

  return (
    <MotionConfig reducedMotion="user">
      <DeviceFrame>
        <div className="app">
          <div className="app-content" data-receded={sheetDepth > 0}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              {TABS.map((key) => (
                <Stack key={key} tab={key} registry={SCREENS} active={tab === key} />
              ))}
              {/* Above the tab bar, so it survives a wander between tabs. */}
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

            <AnimatePresence>
              {!onboarded && (
                <motion.div
                  key="onboarding"
                  initial={false}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
                  style={{ position: 'absolute', inset: 0, zIndex: 400 }}
                >
                  <Onboarding />
                </motion.div>
              )}
            </AnimatePresence>

            <span className="app-recede-dim" aria-hidden="true" />
          </div>

          <div className="sheet-layer" ref={sheetLayer} />
          <ToastHost />
        </div>
      </DeviceFrame>
    </MotionConfig>
  )
}
