import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { setHapticsEnabled } from './haptics'

/** Whatever theme the embedding host stamped before this script ran, if any. */
const HOST_THEME =
  typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null

/**
 * Applies the user's appearance choices to the document, and keeps the iOS
 * status-bar style in step so a home-screen install never shows black text on
 * a black bar.
 */
export function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  const accent = useStore((s) => s.settings.accent)
  const haptics = useStore((s) => s.settings.haptics)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      // A host may have stamped data-theme before our JS ran (the Artifact
      // viewer does this for an explicit light/dark choice). "System" means
      // defer to that stamp, not clobber it.
      if (HOST_THEME) root.setAttribute('data-theme', HOST_THEME)
      else root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }

    const isDark =
      theme === 'dark'
      || (theme === 'system'
        && (HOST_THEME
          ? HOST_THEME === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches))

    const statusBar = document.getElementById('ios-status-bar')
    if (statusBar) statusBar.setAttribute('content', isDark ? 'black-translucent' : 'default')

    // Keep the browser chrome colour in step with the app background.
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
    if (!themeColor) {
      themeColor = document.createElement('meta')
      themeColor.name = 'theme-color'
      document.head.appendChild(themeColor)
    }
    // Read the ground rather than restating it: hard-coding meant the notch
    // area kept Apple's grey for a fortnight after the app moved to chalk.
    // conform-allow: the fallbacks are the ground's own values, for the case
    // where the stylesheet has not resolved yet — a token cannot cover that.
    themeColor.content = getComputedStyle(document.documentElement)
      .getPropertyValue('--grouped').trim() || (isDark ? '#0b0b0c' : '#f1f1ef')
  }, [theme])

  useEffect(() => {
    if (accent === 'blue') document.documentElement.removeAttribute('data-accent')
    else document.documentElement.setAttribute('data-accent', accent)
  }, [accent])

  useEffect(() => {
    setHapticsEnabled(haptics)
  }, [haptics])

  // A system-theme user who flips their phone's appearance should update live.
  useEffect(() => {
    if (theme !== 'system' || HOST_THEME) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const statusBar = document.getElementById('ios-status-bar')
      if (statusBar) statusBar.setAttribute('content', mq.matches ? 'black-translucent' : 'default')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
}

/** Keeps the screen awake during a workout, where supported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        sentinel = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen')
      } catch {
        /* denied or unsupported — the workout still works, the screen just dims */
      }
    }
    void request()
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
