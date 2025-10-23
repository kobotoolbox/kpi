import { Button as ButtonMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { ButtonProps as ButtonPropsMantine, TooltipProps } from '@mantine/core/lib/components'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import Icon, { type IconSize } from './icon'

const ButtonToIconMap: Partial<Record<NonNullable<ButtonProps['size']>, IconSize>> = {
  sm: 'xs',
  md: 's',
  lg: 'm',
}

// See boilerpate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components

export interface ButtonProps extends ButtonPropsMantine {
  tooltip?: React.ReactNode
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  // Standard way of using icons with deterministic sizes.
  // Note: never use Button with just an icon and no text - if you need that, use `ActionIcon` instead.
  leftIcon?: IconName
  rightIcon?: IconName
  leftSection?: never
  rightSection?: never
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tooltip, tooltipProps, leftIcon, rightIcon, ...others }, ref) => {
    const iconSize = ButtonToIconMap[others.size ?? 'sm']
    const leftSection = leftIcon && <Icon name={leftIcon} size={iconSize} />
    const rightSection = rightIcon && <Icon name={rightIcon} size={iconSize} />

    if (!tooltip) {
      return <ButtonMantine {...others} leftSection={leftSection} rightSection={rightSection} ref={ref} />
    }

    return (
      <Tooltip label={tooltip} {...tooltipProps}>
        <ButtonMantine {...others} leftSection={leftSection} rightSection={rightSection} ref={ref} />
      </Tooltip>
    )
  },
)
Button.displayName = 'Button'

// See boilerpate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components
export default createPolymorphicComponent<'button', ButtonProps>(Button)
