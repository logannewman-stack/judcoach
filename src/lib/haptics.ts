/**
 * Haptic feedback.
 *
 * iOS Safari exposes no Vibration API, so on iPhone this is a no-op and the UI
 * leans on animation for confirmation instead; on Android/PWA contexts that do
 * support it, the patterns mirror UIKit's feedback generators.
 */

let enabled = true

export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

type Pattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 5,
  success: [12, 60, 20],
  warning: [18, 70, 18],
  error: [22, 60, 22, 60, 30],
}

export function haptic(pattern: Pattern = 'light'): void {
  if (!enabled) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    /* vibration blocked — ignore */
  }
}
