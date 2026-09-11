import { useRef, useState } from 'react'
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <span
          style={{ position: 'absolute', left: 10, top: 10, pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Icon name="search" size={17} weight={2.2} color="var(--label-3)" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={label}
          style={{
            width: '100%',
            padding: '9px 34px 9px 34px',
            borderRadius: 'var(--r-inset)',
            border: 'none',
            background: 'var(--fill-3)',
            appearance: 'none',
            WebkitAppearance: 'none',
          }}
        />
        {value.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            style={{ position: 'absolute', right: 8, top: 9 }}
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
            style={{
              color: 'var(--accent)',
              fontSize: 17,
              letterSpacing: -0.43,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
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
