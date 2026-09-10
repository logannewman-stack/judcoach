import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

/* ---------------------------- inset grouped list ------------------------ */

export function ListSection({
  header,
  footer,
  plainHeader,
  headerAccessory,
  children,
  style,
}: {
  header?: ReactNode
  footer?: ReactNode
  plainHeader?: boolean
  headerAccessory?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <section className="list-section" style={style}>
      {header && (
        <div
          className={`list-header${plainHeader ? ' plain' : ''}`}
          style={headerAccessory ? { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 } : undefined}
        >
          <span>{header}</span>
          {headerAccessory}
        </div>
      )}
      <div className="list">{children}</div>
      {footer && <div className="list-footer">{footer}</div>}
    </section>
  )
}

export interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  value?: ReactNode
  icon?: IconName
  /** Tinted square behind the icon, iOS Settings style. */
  iconColor?: string
  leading?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  onPress?: () => void
  destructive?: boolean
  tinted?: boolean
  disabled?: boolean
  /** Aligns the separator under the text when there's a leading icon. */
  inset?: boolean
  style?: CSSProperties
}

export function Row({
  title, subtitle, value, icon, iconColor = 'var(--gray)', leading, trailing,
  chevron, onPress, destructive, tinted, disabled, inset, style,
}: RowProps) {
  const Tag = onPress ? 'button' : 'div'
  const color = destructive ? 'var(--red)' : tinted ? 'var(--accent)' : undefined
  return (
    <Tag
      className="row"
      onClick={onPress}
      disabled={onPress ? disabled : undefined}
      type={onPress ? 'button' : undefined}
      style={{
        ...(inset || icon || leading ? { ['--row-sep-inset' as string]: '57px' } : null),
        ...(disabled ? { opacity: 0.45 } : null),
        ...style,
      }}
    >
      {icon && (
        <span className="row-icon" style={{ background: iconColor }}>
          <Icon name={icon} size={18} weight={2.1} color="#fff" />
        </span>
      )}
      {leading}
      <span className="row-body">
        <span className="row-title" style={color ? { color } : undefined}>{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      {value != null && <span className="row-value">{value}</span>}
      {trailing}
      {chevron && <Icon name="chevron.right" size={15} weight={2.6} className="chev" />}
    </Tag>
  )
}
