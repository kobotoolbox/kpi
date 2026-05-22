import type { ComponentType } from 'react'

import type { MantineSize } from '@mantine/core'
import type { IconProps as SvgIconProps } from '@tabler/icons-react'

import type { LegacySvgIconComponent } from './IconLegacySvgMappings'
import type { IconColor } from './icon'

const MantineSizeToPixelsMap: Record<MantineSize, number> = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 28,
}

const IconColorToCssColorMap: Record<IconColor, string> = {
  'mid-red': 'var(--mantine-color-red-6)',
  storm: 'var(--mantine-color-gray-2)',
  teal: 'var(--mantine-color-teal-4)',
  amber: 'var(--mantine-color-amber-6)',
  blue: 'var(--mantine-color-blue-5)',
}

function resolveIconSize(size: KoboIconProps['size']): number | string {
  if (!size) {
    return MantineSizeToPixelsMap.sm
  }
  if (typeof size === 'number') {
    return size
  }
  if (size in MantineSizeToPixelsMap) {
    return MantineSizeToPixelsMap[size as keyof typeof MantineSizeToPixelsMap]
  }
  return size
}

function resolveIconColor(color: KoboIconProps['color']): string | undefined {
  if (!color) {
    return undefined
  }
  return IconColorToCssColorMap[color as IconColor] ?? color
}

export interface KoboIconProps extends Omit<SvgIconProps, 'size' | 'color'> {
  /** Icon component to render */
  icon?: ComponentType<SvgIconProps>
  /** Accepts legacy and Mantine size names */
  size?: MantineSize | number
  /** Supports Kobo semantic colors and any CSS color string */
  color?: IconColor | string
}

/**
 * Preferred icon component for new UI.
 *
 * This component only renders explicit SVG icon components.
 * Outline icons always use a 1.5 stroke width.
 */
export default function KoboIcon({ icon, size, color, ...svgProps }: KoboIconProps) {
  if (!icon) {
    return null
  }
  const IconComponent = icon
  // Tabler icons use stroke width; wrapped legacy SVGs keep their own stroke/fill attributes.
  const isLegacySvg = (IconComponent as LegacySvgIconComponent).isKoboLegacySvgIcon === true
  return (
    <IconComponent
      {...svgProps}
      color={resolveIconColor(color)}
      size={resolveIconSize(size)}
      {...(!isLegacySvg && { stroke: 1.5 })}
    />
  )
}
