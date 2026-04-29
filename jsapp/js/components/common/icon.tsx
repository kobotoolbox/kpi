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

interface IconProps extends Omit<React.ComponentPropsWithoutRef<'i'>, 'color' | 'size'> {
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
 * An icon component.
 */
export default function Icon(props: IconProps) {
  const { name, size, className, color, ...restIconProps } = props

  const classNames: string[] = []
  if (className) {
    classNames.push(className)
  }

  const iconSize = size || DefaultSize
  classNames.push(`k-icon--size-${iconSize}`)

  if (color) {
    classNames.push(`k-icon--color-${color}`)
  }

  classNames.push('k-icon')
  classNames.push(`k-icon-${name}`)

  return <i {...restIconProps} className={classNames.join(' ')} />
}
