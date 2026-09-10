import { Component } from 'react'
import type { ReactNode } from 'react'
import { GritTile } from './Logo'

/* ============================================================================
   Last line of defence.

   Without this a single thrown render — a malformed import, a field an old
   persisted blob never had — leaves a white screen. Worse, the bad data is
   already persisted, so every relaunch lands in the same place and the reset
   button in Settings is unreachable behind it. A client's only remaining option
   is to clear site data, which takes their whole history with it.

   So this has to work with no access to the store, the router, or any component
   that might itself be the thing that threw: plain DOM, inline styles, and
   localStorage read directly.
   ========================================================================== */

const STORE_KEY = 'grit-store-v1'
const PHOTO_KEY = 'grit-photos-v1'

interface State {
  error: Error | null
  /** Counts retries, so a second failure stops offering "Try again". */
  attempts: number
}

function downloadRawBackup() {
  // Deliberately dumps the raw keys rather than going through exportSnapshot —
  // the store is exactly what we cannot trust to be loadable right now.
  let payload = '{}'
  try {
    payload = JSON.stringify(
      {
        app: 'GRIT',
        exportedAt: new Date().toISOString(),
        recoveredFrom: 'error screen',
        store: JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'),
        photos: JSON.parse(localStorage.getItem(PHOTO_KEY) ?? 'null'),
      },
      null,
      2,
    )
  } catch {
    payload = JSON.stringify({ app: 'GRIT', store: localStorage.getItem(STORE_KEY) })
  }
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `grit-recovery-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempts: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error) {
    // No analytics anywhere in this app, so the console is the only record.
    console.error('[GRIT] render failed', error)
  }

  private retry = () => {
    this.setState((s) => ({ error: null, attempts: s.attempts + 1 }))
  }

  private reset = () => {
    try {
      localStorage.removeItem(STORE_KEY)
      localStorage.removeItem(PHOTO_KEY)
    } catch {
      /* if even this fails there is nothing left to try */
    }
    location.reload()
  }

  render() {
    const { error, attempts } = this.state
    if (!error) return this.props.children

    return (
      <div style={shell}>
        <div style={card}>
          <GritTile size={56} />
          <h1 style={heading}>Something went wrong</h1>
          <p style={body}>
            GRIT hit an error it couldn&rsquo;t recover from on its own. Your data is still on
            this device — save a copy before resetting.
          </p>

          <div style={stack}>
            {attempts < 2 && (
              <button type="button" style={filled} onClick={this.retry}>
                Try again
              </button>
            )}
            <button type="button" style={tinted} onClick={downloadRawBackup}>
              Save a copy of my data
            </button>
            <button type="button" style={plain} onClick={() => location.reload()}>
              Reload GRIT
            </button>
            <button type="button" style={destructive} onClick={this.reset}>
              Reset app data
            </button>
          </div>

          <details style={details}>
            <summary style={summary}>Technical detail</summary>
            <pre style={pre}>{error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}

/* Inline styles only — the stylesheet loads before this mounts, but a failure
   this deep should not depend on a class name still meaning what it did. */

const shell: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px max(20px, env(safe-area-inset-left)) 24px max(20px, env(safe-area-inset-right))',
  background: 'var(--bg-grouped, #f2f2f7)',
  color: 'var(--label, #000)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
}

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 14,
}

const heading: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: '29px',
  fontWeight: 700,
  letterSpacing: -0.5,
}

const body: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: '21px',
  color: 'var(--label-2, rgba(60,60,67,0.6))',
}

const stack: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 6,
}

const buttonBase: React.CSSProperties = {
  minHeight: 50,
  borderRadius: 14,
  border: 'none',
  fontSize: 17,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const filled: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--accent, #0a84ff)',
  color: '#fff',
}

const tinted: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--accent-fill, rgba(10,132,255,0.14))',
  color: 'var(--accent, #0a84ff)',
}

const plain: React.CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  color: 'var(--accent, #0a84ff)',
  fontWeight: 500,
}

const destructive: React.CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  color: 'var(--red, #ff3b30)',
  fontWeight: 500,
}

const details: React.CSSProperties = {
  marginTop: 8,
  width: '100%',
  textAlign: 'left',
  fontSize: 13,
  color: 'var(--label-2, rgba(60,60,67,0.6))',
}

const summary: React.CSSProperties = { cursor: 'pointer', padding: '6px 0' }

const pre: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: 10,
  background: 'var(--fill-3, rgba(118,118,128,0.12))',
  fontSize: 12,
  lineHeight: '17px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}
