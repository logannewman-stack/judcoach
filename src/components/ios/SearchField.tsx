import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../Icon'

/**
 * iOS search bar: a Cancel button slides in while the field is focused, and
 * clears and dismisses in one tap.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const active = focused || value.length > 0

  /* Escape is what clears a search field on every platform that has a keyboard,
     and without it the only way out of a full field was to Tab to Cancel. The
     press is swallowed so the sheet this field sits in does not also take it —
     clearing the search and dismissing the sheet are not one action. */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    if (value.length > 0) {
      onChange('')
      return
    }
    inputRef.current?.blur()
    setFocused(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        {/* Centred rather than pinned 10px down: the field grows with the
            client's text size and the glyph has to stay on the text's line. */}
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <Icon name="search" size={17} weight={2.4} color="var(--label-3)" />
        </span>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {value.length > 0 && (
          /* A 44pt target on an 18pt glyph, drawn inside the field so it cannot
             reach across into Cancel: the clear button was 18 × 18, which only
             escaped the audit because the audit never types anything. */
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="xmark.circle.fill" size={18} color="var(--label-3)" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {active && (
          <motion.button
            type="button"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              inputRef.current?.blur()
              setFocused(false)
            }}
            // 44pt like any other bar button, and in points of the type scale
            // rather than frozen at 17px beside a field that grows.
            style={{
              color: 'var(--accent)',
              fontSize: 'calc(17 * var(--pt))',
              letterSpacing: '-0.025294em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              minHeight: 44,
              paddingLeft: active ? 12 : 0,
            }}
          >
            Cancel
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
