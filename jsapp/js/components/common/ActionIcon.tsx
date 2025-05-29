import { ActionIcon as ActionIconMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { ActionIconProps as ActionIconPropsMantine } from '@mantine/core/lib/components'
import type { TooltipProps } from '@mantine/core/lib/components'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import Icon, { type IconSize } from './icon'

export interface ActionIconProps extends Omit<ActionIconPropsMantine, 'size'> {
  iconName: IconName
  size: 'sm' | 'md' | 'lg'
  tooltip?: React.ReactNode
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>
}

const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(
  ({ iconName, tooltip, tooltipProps, ...others }, ref) => {
    // Currently, our icon sizes only use a single letter instead of
    // Mantine's 'sm', 'md', etc. So here we grab the first letter.
    const iconSize = others.size[0] as IconSize
    if (!tooltip) {
      return (
        <ActionIconMantine {...others} ref={ref}>
          <Icon name={iconName} size={iconSize} />
        </ActionIconMantine>
      )
    }

    return (
      <Tooltip label={tooltip} {...tooltipProps}>
        <ActionIconMantine {...others} ref={ref}>
          <Icon name={iconName} size={iconSize} />
        </ActionIconMantine>
      </Tooltip>
    )
  },
)
ActionIcon.displayName = 'ActionIcon'

export default createPolymorphicComponent<'button', ActionIconProps>(ActionIcon)
