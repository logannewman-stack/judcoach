import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { App } from './App'
import { useNav } from './nav/nav'
import { useStore } from './store/useStore'

// Dev-only handle so the screen walkthrough can drive navigation directly.
// Stripped from production builds by the DEV guard.
if (import.meta.env.DEV) {
  const w = window as unknown as { __nav: typeof useNav; __store: typeof useStore }
  w.__nav = useNav
  w.__store = useStore
}

// Offline support for the real PWA build. The single-file preview ships as one
// document with no worker to register, so it opts out.
const SINGLE_FILE = import.meta.env.VITE_SINGLE_FILE === '1'
if (import.meta.env.PROD && !SINGLE_FILE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
