import type { MantineSize } from '@mantine/core'
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

const MantineSizeToPixelsMap: Record<MantineSize, number> = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 28,
}

const MantineSizeToLegacyIconSizeMap: Record<MantineSize, Exclude<IconSize, 'inherit'>> = {
  xs: 'xs',
  sm: 's',
  md: 'm',
  lg: 'l',
  xl: 'xl',
}

const IconColorToCssColorMap: Record<IconColor, string> = {
  'mid-red': 'var(--mantine-color-red-6)',
  storm: 'var(--mantine-color-gray-2)',
  teal: 'var(--mantine-color-teal-4)',
  amber: 'var(--mantine-color-amber-6)',
  blue: 'var(--mantine-color-blue-5)',
}

export interface KoboIconProps extends Omit<SvgIconProps, 'size' | 'color'> {
  /** Legacy icon name from `#/k-icons` */
  name?: IconName
  /** Icon component to render directly */
  icon?: ComponentType<SvgIconProps>
  /** Accepts legacy and Mantine size names */
  size?: IconSize | MantineSize | number
  /** Supports Kobo semantic colors and any CSS color string */
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
  if (size in IconSizeToPixelsMap) {
    return IconSizeToPixelsMap[size as keyof typeof IconSizeToPixelsMap]
  }
  if (size in MantineSizeToPixelsMap) {
    return MantineSizeToPixelsMap[size as keyof typeof MantineSizeToPixelsMap]
  }
  return size
}

function resolveLegacyIconSize(size: KoboIconProps['size']): IconSize | undefined {
  if (typeof size === 'number') {
    return 'inherit'
  }
  if (!size) {
    return undefined
  }
  if (size === 'inherit') {
    return 'inherit'
  }
  if (size in IconSizeToPixelsMap) {
    return size as Exclude<IconSize, 'inherit'>
  }
  if (size in MantineSizeToLegacyIconSizeMap) {
    return MantineSizeToLegacyIconSizeMap[size as MantineSize]
  }
  return undefined
}

function resolveIconColor(color: KoboIconProps['color']): string | undefined {
  if (!color) {
    return undefined
  }
  return IconColorToCssColorMap[color as IconColor] ?? color
}

/**
 * Icon component that handles legacy k-icon and tabler icons.
 *
 * Migration behavior:
 * 1. If `icon` is provided, use it
 * 2. Else if `name` maps to tabler icon, use the mapping
 * 3. Else fallback to legacy font icon (`Icon` component)
 */
export default function KoboIcon({ name, icon, size, color, ...svgProps }: KoboIconProps) {
  // If icon (component) is provided, we will use it, otherwise we will try to map provided legacy name to tabler icon
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
  } else if (name) {
    // If we weren't able to render tabler icon, we will try to use name to render legacy k-icon
    return (
      <Icon
        className={svgProps.className}
        color={typeof color === 'string' && isLegacyIconColor(color) ? color : undefined}
        name={name}
        size={resolveLegacyIconSize(size)}
      />
    )
  }
  return null
}
