import { useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion, useDragControls } from 'framer-motion'
import { Stack } from './nav/Stack'
import { TabBar } from './nav/TabBar'
import { TABS, useNav } from './nav/nav'
import { SCREENS } from './screens/registry'
import { ToastHost, toast } from './components/ios/Toast'
import { registerSheetLayer, useSheetLayer } from './components/ios/SheetLayer'
import { RestTimerBar } from './components/RestTimer'
import { ActiveWorkoutBar } from './components/ActiveWorkoutBar'
import { DeviceFrame } from './components/DeviceFrame'
import { FullScreenDragContext } from './nav/FullScreenDrag'
import { Onboarding } from './screens/Onboarding'
import { useTheme, useWakeLock } from './lib/useTheme'
import { useStore } from './store/useStore'
import { onStorageProblem } from './store/persist'

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
  const dragControls = useDragControls()
  const dismiss = useNav((s) => s.dismiss)
  useWakeLock(keepAwake && !!active)

  /* A full disk used to throw out of the store and into whichever component
     dispatched the action — mid-workout that meant a lost set and no timer. The
     write now fails quietly and says so here, with the one thing worth doing. */
  useEffect(() => {
    let warned = false
    onStorageProblem((problem) => {
      if (warned) return
      warned = true
      toast(
        problem === 'quota'
          ? 'Storage full. Delete a few progress photos.'
          : "This browser isn't saving data. Private mode?",
        { icon: 'xmark.circle.fill', tone: 'bad' },
      )
      window.setTimeout(() => { warned = false }, 30_000)
    })
  }, [])

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
                  // The gesture is started by the presented screen's own
                  // toolbar, so the scroll view never fights it.
                  drag="y"
                  dragListener={false}
                  dragControls={dragControls}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.75 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 130 || info.velocity.y > 700) dismiss()
                  }}
                  style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--grouped)' }}
                >
                  <FullScreenDragContext.Provider value={dragControls}>
                    <FullScreenComponent {...(fullScreen.params ?? {})} />
                  </FullScreenDragContext.Provider>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The rest timer sits above the workout runner: the one screen a
                lifter actually needs it on was the one screen it was hidden
                behind. It clears the tab bar only when the tab bar is there. */}
            <RestTimerBar
              bottomOffset={fullScreen ? 'calc(var(--sa-bottom) + 12px)' : 'calc(var(--tab-h) + var(--sa-bottom) + 12px)'}
            />
            <ActiveWorkoutBar bottomOffset="calc(var(--tab-h) + var(--sa-bottom) + 12px)" />

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
