import cx from 'clsx'
import type { CSSProperties } from 'react'
import styles from './ClampedTitle.module.scss'

interface ClampedTitleProps {
  /**
   * Text to clamp. Intentionally a string, not `ReactNode`: the CSS clamp
   * relies on `display: -webkit-box`, which only lays out text reliably.
   */
  children: string
  /** How many lines to display before truncating with an ellipsis. */
  lines?: number
  className?: string
}

/**
 * Clamps text to a fixed number of lines (2 by default), truncating the
 * overflow with an ellipsis. Useful for headings that embed user-provided
 * content, e.g. a modal title containing a project name.
 *
 * The clamping is pure CSS, so it adapts to any container width without
 * measuring. Inherits font styling from its parent, so it can be dropped into
 * a modal `title` without restyling it:
 *
 * ```tsx
 * modals.open({
 *   title: <ClampedTitle>{t('Sharing Permissions: ##name##').replace('##name##', assetName)}</ClampedTitle>,
 *   children: …,
 * })
 * ```
 *
 * When a title is composed of several elements, wrap just the text part:
 *
 * ```tsx
 * <Group>
 *   <ClampedTitle>{assetName}</ClampedTitle>
 *   <SomeBadge />
 * </Group>
 * ```
 */
export default function ClampedTitle({ children, lines = 2, className }: ClampedTitleProps) {
  return (
    <span
      className={cx(styles.root, className)}
      style={{ '--clamped-title-lines': lines } as CSSProperties}
      // Full text stays reachable on hover for the truncated case.
      title={children}
    >
      {children}
    </span>
  )
}
