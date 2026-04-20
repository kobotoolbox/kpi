import './icon.scss'

import React from 'react'

import type { IconName } from '#/k-icons'

/**
 * Check out `icon.scss` file for exact pixel values.
 *
 * Note: we have `inherit` option for backwards compatibility. It will cause the icon to be sized based on `font-size`
 * of the parent. Context: sometimes we rendered icon by just having `k-icon` class name (i.e. without size), current
 * implementation defaults to `s` size (behaviour difference).
 */
export type IconSize = 'l' | 'm' | 's' | 'xl' | 'xs' | 'xxs' | 'inherit'
export type IconColor = 'mid-red' | 'storm' | 'teal' | 'amber' | 'blue'

const DefaultSize = 's'

interface IconProps {
  name: IconName
  size?: IconSize
  /** Additional class names. */
  className?: string
  /**
   * Useful if you need some color for the icon, and the color doesn't come from
   * parent component (e.g. Button).
   */
  color?: IconColor
}

/**
 * An icon component that renders legacy font icons and is kept for backwards compatibility.
 *
 * @deprecated Please use `KoboIcon`. See `KoboIconMappings` for the old-to-new map. If you need to support both `Icon`
 * and `KoboIcon` in some universal component, please use `IconLegacySupport`.
 *
 * ## Migration notes
 * When switching from old icons to new, when you migrate an icon, e.g. "language", let's migrate all places that use
 * it, and then delete the old icon. Places to look at:
 * - `jsapp/svg-icons` (delete icon SVG file, make sure to rerun `npm run generate-icons`)
 * - `jsapp/js/components/common/KoboIconMappings.ts` (delete a line)
 * - `jsapp/js/components/common/IconLegacySvgMappings.tsx` (delete two lines)
 */
export default function Icon(props: IconProps) {
  const classNames: string[] = []
  if (props.className) {
    classNames.push(props.className)
  }

  const size = props.size || DefaultSize
  classNames.push(`k-icon--size-${size}`)

  if (props.color) {
    classNames.push(`k-icon--color-${props.color}`)
  }

  classNames.push('k-icon')
  classNames.push(`k-icon-${props.name}`)

  return <i className={classNames.join(' ')} />
}
