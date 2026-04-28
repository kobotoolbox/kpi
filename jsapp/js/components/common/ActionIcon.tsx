import { ActionIcon as ActionIconMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { ActionIconProps as ActionIconPropsMantine } from '@mantine/core/lib/components'
import type { TooltipProps } from '@mantine/core/lib/components'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import Icon, { type IconSize } from './icon'

export interface ActionIconProps extends Omit<ActionIconPropsMantine, 'size'> {
  /** Text for tooltip */
  tooltip?: React.ReactNode
  /** Additional tooltip configuration */
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  iconName: IconName
  size: 'sm' | 'md' | 'lg' | 'xl'
}

const MANTINE_TO_ICON_SIZE_MAP: Record<ActionIconProps['size'], IconSize> = {
  sm: 's',
  md: 'm',
  lg: 'l',
  xl: 'xl',
}

const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(({ iconName, ...props }, ref) => {
  const iconSize = MANTINE_TO_ICON_SIZE_MAP[props.size]

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
