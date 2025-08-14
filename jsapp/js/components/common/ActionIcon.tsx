import { ActionIcon as ActionIconMantine, createPolymorphicComponent, Tooltip } from '@mantine/core'
import type { ActionIconProps as ActionIconPropsMantine } from '@mantine/core/lib/components'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import Icon, { type IconSize } from './icon'
import { TooltipProps } from '@mantine/core/lib/components'

export interface ActionIconProps extends Omit<ActionIconPropsMantine, 'size'> {
  /** Text for tooltip */
  tooltip?: React.ReactNode
  /** Additional tooltip configuration */
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  iconName: IconName
  size: 'sm' | 'md' | 'lg'
}

const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(({ iconName, ...props }, ref) => {
  // Currently, our icon sizes only use a single letter instead of
  // Mantine's 'sm', 'md', etc. So here we grab the first letter.
  const iconSize = props.size[0] as IconSize

  if (!props.tooltip) {
    return (
      <ActionIconMantine {...props} ref={ref}>
        <Icon name={iconName} size={iconSize} />
      </ActionIconMantine>
    )
  }

  return (
    <Tooltip label={props.tooltip} {...props.tooltipProps}>
      <ActionIconMantine {...props} ref={ref}>
        <Icon name={iconName} size={iconSize} />
      </ActionIconMantine>
    </Tooltip>
  )
})
ActionIcon.displayName = 'ActionIcon'

export default createPolymorphicComponent<'button', ActionIconProps>(ActionIcon)
