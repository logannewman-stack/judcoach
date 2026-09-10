import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/* Small shared display pieces used across screens. */

export function SectionHeader({
  title,
  action,
  style,
}: {
  title: ReactNode
  action?: { label: string; onPress: () => void }
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 var(--gutter) 8px',
        ...style,
      }}
    >
      <h2 className="t-title3">{title}</h2>
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
  return (
    <Tag
      onClick={onPress}
      type={onPress ? 'button' : undefined}
      className={onPress ? 'pressable' : undefined}
      style={{
        background: 'var(--grouped-2)',
        borderRadius: 'var(--r-card)',
        padding: '12px 13px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        width: '100%',
      }}
    >
      <span
        className="t-caption1 dim truncate"
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
      >
        {icon && <Icon name={icon} size={12} weight={2.4} color={tone ?? 'var(--label-2)'} />}
        {label}
      </span>
      <span
        className="t-title3 mono-nums truncate"
        style={{ color: tone, fontWeight: 700, letterSpacing: -0.3 }}
      >
        {value}
      </span>
      {caption && <span className="t-caption1 dim truncate">{caption}</span>}
    </Tag>
  )
}

export function Card({
  children,
  onPress,
  pad = true,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  pad?: boolean
  style?: CSSProperties
}) {
  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag
      className={`card${pad ? ' card-pad' : ''}`}
      onClick={onPress}
      type={onPress ? 'button' : undefined}
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

/** Coach's initial badge — stands in for Jud throughout the app. */
export function CoachAvatar({ size = 34, name = 'Jud' }: { size?: number; name?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(160deg, var(--accent) 0%, var(--indigo) 100%)',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.42,
        letterSpacing: 0.2,
      }}
    >
      {name[0]}
    </span>
  )
}

/** Quote-style block for the coach's note on a session or week. */
export function CoachNote({ children, name = 'Jud' }: { children: ReactNode; name?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 13,
        borderRadius: 12,
        background: 'var(--accent-soft)',
      }}
    >
      <CoachAvatar size={28} name={name} />
      <div style={{ minWidth: 0 }}>
        <div className="t-caption1 semibold" style={{ color: 'var(--accent)', marginBottom: 1 }}>
          {name}
        </div>
        <div className="t-subhead" style={{ lineHeight: '19px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <div
      style={{
        height: 'var(--hairline)',
        background: 'var(--sep)',
        marginLeft: inset,
        transform: 'scaleY(0.6)',
      }}
    />
  )
}
