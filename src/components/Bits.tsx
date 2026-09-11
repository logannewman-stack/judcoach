import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { initials } from '../lib/format'

/* Small shared display pieces used across screens. */

/**
 * The label above a section of a screen, in one of the app's two ranks.
 *
 * Default — a heading a person reads as language ("Fuel", "Every set"), in SF.
 * `eyebrow` — a label on data ("THIS WEEK", "PER SIDE"), in the data face. It is
 * the same role `ListSection` gives a group header, so a screen made of cards
 * and a screen made of lists label themselves identically.
 */
export function SectionHeader({
  title,
  action,
  eyebrow,
  style,
}: {
  title: ReactNode
  action?: { label: string; onPress: () => void }
  eyebrow?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: eyebrow ? '0 var(--gutter) 7px' : '0 var(--gutter) 8px',
        ...style,
      }}
    >
      <h2 className={eyebrow ? 'eyebrow' : 't-title3'}>{title}</h2>
      {action && (
        <button
          type="button"
          className="t-subhead tint semibold hit-expand"
          onClick={action.onPress}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/**
 * A tile's tone is type, not a fill: systemGreen is 2.2:1 on white and
 * systemYellow 1.5:1. Callers still name the colour they mean, and it resolves
 * to the darker twin iOS ships for text.
 */
const TEXT_TONE: Record<string, string> = {
  'var(--red)': 'var(--red-text)',
  'var(--orange)': 'var(--orange-text)',
  'var(--yellow)': 'var(--yellow-text)',
  'var(--green)': 'var(--green-text)',
  'var(--cyan)': 'var(--cyan-text)',
}

export function StatTile({
  label,
  value,
  caption,
  tone,
  icon,
  onPress,
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  tone?: string
  icon?: IconName
  onPress?: () => void
}) {
  const Tag = onPress ? 'button' : 'div'
  const toneColor = tone ? TEXT_TONE[tone] ?? tone : undefined
  return (
    // A number under a label is the definition of the two data roles, so a tile
    // is where they are least negotiable: eyebrow above, figure below.
    <Tag
      onClick={onPress}
      type={onPress ? 'button' : undefined}
      className={onPress ? 'surface pressable' : 'surface'}
      style={{
        padding: '11px 13px 12px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
        width: '100%',
      }}
    >
      {/* The label wraps rather than truncating — three tiles across a 393px
          screen leaves about 88px, which clips anything longer than one short
          word. Tiles stretch to the tallest in their row, so the value is
          pushed to the bottom and stays aligned across all of them. */}
      <span
        className="eyebrow"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}
      >
        {icon && (
          <Icon
            name={icon}
            size={11}
            weight={2.6}
            color={toneColor ?? 'var(--label-2)'}
            style={{ flex: 'none', marginTop: 1 }}
          />
        )}
        {label}
      </span>
      {/* A tile read aloud is "THIS WEEK 25,295 lb moved" — the label and the
          number run into one phrase. The commas are the pause the layout gives a
          sighted reader. */}
      <span className="sr-only">, </span>
      <span
        className="data truncate"
        style={{ color: toneColor, fontSize: 'calc(20 * var(--pt))', lineHeight: 'calc(23 * var(--pt))', fontWeight: 700, marginTop: 'auto' }}
      >
        {value}
      </span>
      {caption && <span className="sr-only">, </span>}
      {caption && <span className="t-caption1 dim truncate">{caption}</span>}
    </Tag>
  )
}

/**
 * A card is one surface on the ground. `current` marks the single card on a
 * screen that carries what is true now — the live week, today's session — with
 * an accent hairline and nothing else. Two of them on one screen means neither
 * is current.
 */
export function Card({
  children,
  onPress,
  pad = true,
  current,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  pad?: boolean
  current?: boolean
  style?: CSSProperties
}) {
  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag
      className={`card${pad ? ' card-pad' : ''}`}
      onClick={onPress}
      type={onPress ? 'button' : undefined}
      data-current={current ? 'true' : undefined}
      style={{ width: 'calc(100% - var(--gutter) * 2)', textAlign: 'left', display: 'block', ...style }}
    >
      {children}
    </Tag>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={38} weight={1.5} color="var(--label-3)" />
      <div className="t-headline" style={{ color: 'var(--label)' }}>{title}</div>
      {message && <div className="t-subhead" style={{ maxWidth: 280 }}>{message}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

/**
 * Coach's initial badge — stands in for Jud throughout the app.
 *
 * Flat accent, not a gradient: a monogram is a mark, so it is set in the data
 * face and left to be one colour. The app has one accent and this is the person
 * behind everything it asks you to do.
 */
export function CoachAvatar({ size = 34, name = 'Jud' }: { size?: number; name?: string }) {
  return (
    <span
      aria-hidden="true"
      className="data"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--accent)',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.44,
        lineHeight: 1,
      }}
    >
      {name[0]}
    </span>
  )
}

/**
 * The client's own monogram, in the same material as the coach's badge but
 * neutral — they are not the accent, and a photo-shaped grey gradient with white
 * initials on it was both a decoration and unreadable at 1:1 contrast.
 */
export function Monogram({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="data"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--fill-3)',
        color: 'var(--label-2)',
        fontSize: size * 0.38,
        lineHeight: 1,
        letterSpacing: '0.01em',
      }}
    >
      {initials(name)}
    </span>
  )
}

/** Quote-style block for the coach's note on a session or week. */
/**
 * Jud's instruction on part of the plan — a week's emphasis, a session note, a
 * cue on an exercise.
 *
 * Deliberately unlike a message: prescription and correspondence both carry his
 * voice, and when a real note from him sits on the same screen, two identical
 * avatar blocks read as two messages and neither gets the weight it deserves.
 */
export function CoachNote({ children, name = 'Jud' }: { children: ReactNode; name?: string }) {
  return (
    <div className="coach-quote">
      <div className="coach-quote-label">{name}&rsquo;s note</div>
      <div className="coach-quote-body">{children}</div>
    </div>
  )
}
