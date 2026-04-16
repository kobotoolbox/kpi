import type { IconProps as SvgIconProps } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import type { IconName } from '#/k-icons'
import { resolveIconByLegacyName } from './KoboIconMappings'
import Icon, { type IconColor, type IconSize } from './icon'

const LegacyIconColors: IconColor[] = ['mid-red', 'storm', 'teal', 'amber', 'blue']

const IconSizeToPixelsMap: Record<Exclude<IconSize, 'inherit'>, number> = {
  xxs: 10,
  xs: 14,
  s: 18,
  m: 20,
  l: 22,
  xl: 28,
}

const IconColorToCssColorMap: Record<IconColor, string> = {
  'mid-red': 'var(--mantine-color-red-6)',
  storm: 'var(--mantine-color-gray-2)',
  teal: 'var(--mantine-color-teal-4)',
  amber: 'var(--mantine-color-amber-6)',
  blue: 'var(--mantine-color-blue-5)',
}

export interface KoboIconProps extends Omit<SvgIconProps, 'size' | 'color'> {
  /** Legacy icon name from `#/k-icons`. */
  name?: IconName
  /** Optional icon component to render directly. */
  icon?: ComponentType<SvgIconProps>
  /** Reuses legacy icon scale tokens for easy migration. */
  size?: IconSize | number
  /** Supports Kobo semantic colors and any CSS color string. */
  color?: IconColor | string
}

function isLegacyIconColor(value: string): value is IconColor {
  return LegacyIconColors.includes(value as IconColor)
}

function resolveIconSize(size: KoboIconProps['size']): number | string {
  if (typeof size === 'number') {
    return size
  }
  if (!size) {
    return IconSizeToPixelsMap.s
  }
  if (size === 'inherit') {
    return '1em'
  }
  return IconSizeToPixelsMap[size]
}

function resolveIconColor(color: KoboIconProps['color']): string | undefined {
  if (!color) {
    return undefined
  }
  return IconColorToCssColorMap[color as IconColor] ?? color
}

/**
 * Preferred icon component for all new UI.
 *
 * Migration behavior:
 * 1. If `icon` is provided, use it.
 * 2. Else if `name` maps to an SVG icon, use the mapping.
 * 3. Else fallback to legacy font icon (`Icon`).
 */
export default function KoboIcon({ name, icon, size, color, ...svgProps }: KoboIconProps) {
  const resolvedIcon = icon ?? (name ? resolveIconByLegacyName(name) : undefined)

  if (resolvedIcon) {
    const IconComponent = resolvedIcon
    return (
      <IconComponent
        {...svgProps}
        color={resolveIconColor(color)}
        size={resolveIconSize(size)}
        stroke={svgProps.stroke ?? 1.75}
      />
    )
  }

  if (!name) {
    return null
  }

  return (
    <Icon
      className={svgProps.className}
      color={typeof color === 'string' && isLegacyIconColor(color) ? color : undefined}
      name={name}
      size={typeof size === 'number' ? 'inherit' : size}
    />
  )
}
