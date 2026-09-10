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
  compact,
}: {
  placeholder: string
  onSend: (body: string) => void
  /** Shown as a dismiss control where the box is opened on demand. */
  onCancel?: () => void
  autoFocus?: boolean
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
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
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
        <Icon name="send.fill" size={19} weight={2.6} />
      </button>
    </div>
  )
}
