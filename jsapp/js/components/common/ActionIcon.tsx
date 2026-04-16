import { ActionIcon as ActionIconMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { ActionIconProps as ActionIconPropsMantine } from '@mantine/core/lib/components'
import type { TooltipProps } from '@mantine/core/lib/components'
import type { TablerIcon } from '@tabler/icons-react'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import KoboIcon from './KoboIcon'
import Icon, { type IconSize } from './icon'

export interface ActionIconProps extends Omit<ActionIconPropsMantine, 'size'> {
  /** Text for tooltip */
  tooltip?: React.ReactNode
  /** Additional tooltip configuration */
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>
  /** @deprecated Legacy icon name from `k-icons`, please use `icon` */
  iconName?: IconName
  /** Icon component from `@tabler/icons-react` */
  icon?: TablerIcon
  size: 'sm' | 'md' | 'lg'
}

const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(({ iconName, icon, ...props }, ref) => {
  const legacyIconSize = props.size[0] as IconSize
  const content =
    props.children ??
    (icon ? (
      <KoboIcon icon={icon} size={props.size} />
    ) : iconName ? (
      <Icon name={iconName} size={legacyIconSize} />
    ) : null)

  if (!props.tooltip) {
    return (
      <ActionIconMantine {...props} ref={ref}>
        {content}
      </ActionIconMantine>
    )
  }

  return (
    <Tooltip label={props.tooltip} {...props.tooltipProps}>
      <ActionIconMantine {...props} ref={ref}>
        {content}
      </ActionIconMantine>
    </Tooltip>
  )
})
ActionIcon.displayName = 'ActionIcon'

export default createPolymorphicComponent<'button', ActionIconProps>(ActionIcon)
