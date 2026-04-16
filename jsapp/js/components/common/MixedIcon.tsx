import type { MantineSize } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { IconName } from '#/k-icons'
import KoboIcon from './KoboIcon'
import Icon, { type IconSize } from './icon'

export interface MixedIconProps {
  icon: IconName | TablerIcon
  size?: MantineSize | IconSize
}

/**
 * Transition component for places that need to support both legacy `Icon` (icon font, AKA k-icon) and the modern
 * KoboIcon (SVG/tabler based).
 * Prefer using `KoboIcon` directly for new code.
 */
export default function MixedIcon({ icon, size }: MixedIconProps) {
  if (typeof icon === 'string') {
    return <Icon name={icon} size={size as IconSize} />
  }

  return <KoboIcon icon={icon} size={size as MantineSize} />
}
