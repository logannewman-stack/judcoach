import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { readsAsFigure } from '../../lib/format'

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
        // A group's header is a label above data, which is what the eyebrow role
        // is for. `plainHeader` is the exception: a sentence-case heading is
        // language, so it stays in SF.
        //
        // It is also an <h2>, as SectionHeader's is: a section header is how a
        // reader using the heading rotor finds the part of the screen they want,
        // and a screen made entirely of groups had nothing for them to land on
        // between the title and the last row. The accessory stays outside the
        // heading — it is a control, not part of the name.
        <div
          className={plainHeader ? 'list-header plain' : 'list-header eyebrow'}
          style={headerAccessory ? { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 } : undefined}
        >
          <h2 style={HEADER_TEXT}>{header}</h2>
          {headerAccessory}
        </div>
      )}
      <div className="list">{children}</div>
      {footer && <div className="list-footer">{footer}</div>}
    </section>
  )
}

/** The heading carries no type of its own — `.list-header` already set it. */
const HEADER_TEXT: CSSProperties = { font: 'inherit', letterSpacing: 'inherit', color: 'inherit' }

/** The row's own left padding and the gap it puts between leading and text. */
const ROW_GUTTER = 18
const ROW_GAP = 12

/**
 * Where a row's separator starts when something leads the text. Callers pass
 * the width of their own leading element; 29 is the iOS Settings icon, which is
 * what `icon` renders.
 */
export const rowSepInset = (leadingWidth: number) => ROW_GUTTER + leadingWidth + ROW_GAP

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
  /**
   * Where the separator starts, in px, for a `leading` element that isn't the
   * 29px width `icon` uses. `rowSepInset` works it out from that width.
   */
  sepInset?: number
  /** Names the row when its title alone doesn't say what it acts on. */
  ariaLabel?: string
  style?: CSSProperties
}

export function Row({
  title, subtitle, value, icon, iconColor = 'var(--gray)', leading, trailing,
  chevron, onPress, destructive, tinted, disabled, inset, sepInset, ariaLabel, style,
}: RowProps) {
  const Tag = onPress ? 'button' : 'div'
  const color = destructive ? 'var(--red)' : tinted ? 'var(--accent)' : undefined
  const separatorInset = sepInset ?? (inset || icon || leading ? rowSepInset(29) : undefined)
  return (
    <Tag
      className="row"
      onClick={onPress}
      disabled={onPress ? disabled : undefined}
      type={onPress ? 'button' : undefined}
      aria-label={ariaLabel}
      style={{
        ...(separatorInset != null ? { ['--row-sep-inset' as string]: `${separatorInset}px` } : null),
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
        {/* Read aloud, a row is one string: "Appearance Match iPhone",
            "Programme Block 3 · Strength + Size · week 5 of 8". UIKit puts a
            comma between a cell's label and its detail so the two land as two
            facts with a beat between them; nothing on the web does that for us,
            so the comma is real text that is never drawn. */}
        {subtitle && <span className="sr-only">, </span>}
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      {/* 63 weigh-ins, 315 lb, 8 weeks: a row's value is usually a number, and a
          number is set in the data face. A value that reads as language — a
          name, "Match iPhone" — stays in SF. */}
      {value != null && <span className="sr-only">, </span>}
      {value != null && (
        <span className={readsAsFigure(value) ? 'row-value data' : 'row-value'}>{value}</span>
      )}
      {trailing}
      {chevron && <Icon name="chevron.right" size={15} weight={2.6} className="chev" />}
    </Tag>
  )
}
