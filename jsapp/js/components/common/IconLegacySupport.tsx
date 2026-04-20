import type { MantineSize } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { IconName } from '#/k-icons'
import KoboIcon from './KoboIcon'
import { resolveIconComponentByLegacyName } from './KoboIconMappings'
import type { IconSize } from './icon'

export interface IconLegacySupportProps {
  icon: IconName | TablerIcon
  size?: MantineSize | IconSize
}

const IconSizeToPixelsMap: Record<Exclude<IconSize, 'inherit'>, number> = {
  xxs: 10,
  xs: 14,
  s: 18,
  m: 20,
  l: 22,
  xl: 28,
}

function resolveKoboIconSize(size: IconLegacySupportProps['size']): MantineSize | number | undefined {
  if (!size) {
    return undefined
  }
  if (size === 'inherit') {
    return 18
  }
  if (size in IconSizeToPixelsMap) {
    return IconSizeToPixelsMap[size as Exclude<IconSize, 'inherit'>]
  }
  return size as MantineSize
}

/**
 * Transition component for places that need to support both legacy `Icon` (icon font, AKA k-icon) and the modern
 * KoboIcon (SVG/tabler based).
 * Prefer using `KoboIcon` directly for new code.
 */
export default function IconLegacySupport({ icon, size }: IconLegacySupportProps) {
  if (typeof icon === 'string') {
    const resolvedIcon = resolveIconComponentByLegacyName(icon)
    return <KoboIcon icon={resolvedIcon} size={resolveKoboIconSize(size)} />
  }

  return <KoboIcon icon={icon} size={resolveKoboIconSize(size)} />
}
