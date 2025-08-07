import { ActionIcon as ActionIconMantine, createPolymorphicComponent } from '@mantine/core'
import type { ActionIconProps as ActionIconPropsMantine } from '@mantine/core/lib/components'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import Icon, { type IconSize } from './icon'

export interface ActionIconProps extends Omit<ActionIconPropsMantine, 'size'> {
  iconName: IconName
  size: 'sm' | 'md' | 'lg'
}

const ActionIcon = forwardRef<HTMLButtonElement, ActionIconProps>(({ iconName, ...props }, ref) => {
  // Currently, our icon sizes only use a single letter instead of
  // Mantine's 'sm', 'md', etc. So here we grab the first letter.
  const iconSize = props.size[0] as IconSize
  return (
    <ActionIconMantine {...props} ref={ref}>
      <Icon name={iconName} size={iconSize} />
    </ActionIconMantine>
  )
})
ActionIcon.displayName = 'ActionIcon'

export default createPolymorphicComponent<'button', ActionIconProps>(ActionIcon)
