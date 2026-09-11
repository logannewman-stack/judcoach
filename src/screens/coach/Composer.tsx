import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'

/* ============================================================================
   The message box.

   Shared by the thread and by every reply box on a record, so a message written
   next to a set behaves exactly like one written in the conversation.
   ========================================================================== */

export function Composer({
  placeholder,
  onSend,
  onCancel,
  autoFocus,
  focusSignal,
  compact,
}: {
  placeholder: string
  onSend: (body: string) => void
  /** Shown as a dismiss control where the box is opened on demand. */
  onCancel?: () => void
  autoFocus?: boolean
  /**
   * Any change puts the cursor in the box, for a screen whose empty state
   * carries the call to action rather than the field itself.
   */
  focusSignal?: number
  compact?: boolean
}) {
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const ready = draft.trim().length > 0

  // Grow with the text up to the CSS max-height, and shrink back on send.
  const resize = () => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(resize, [draft])

  useEffect(() => {
    if (focusSignal) field.current?.focus()
  }, [focusSignal])

  const submit = () => {
    if (!ready) return
    onSend(draft.trim())
    setDraft('')
    // Return focus so a second message does not need another tap.
    requestAnimationFrame(() => field.current?.focus())
  }

  return (
    <div className={`compose${compact ? ' compact' : ''}`}>
      {onCancel && (
        <button type="button" className="compose-cancel" aria-label="Close" onClick={onCancel}>
          <Icon name="xmark" size={17} weight={2.4} />
        </button>
      )}
      <textarea
        ref={field}
        className="compose-field"
        rows={1}
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        // Return is a line break, and the button is how a message goes. The
        // escape hatch used to be Shift+Return, which an iPhone's software
        // keyboard has no way to type: every paragraph break a client tried to
        // make sent the half-written message instead. iOS Messages does the
        // same — the key says "return" and it returns.
        enterKeyHint="enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onCancel) onCancel()
        }}
      />
      <button
        type="button"
        className="compose-send"
        disabled={!ready}
        aria-label="Send"
        onClick={submit}
      >
        <Icon name="send" size={19} weight={2.6} />
      </button>
    </div>
  )
}
