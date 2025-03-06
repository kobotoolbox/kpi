import { Button as ButtonMantine, createPolymorphicComponent, MantineSize, Tooltip } from '@mantine/core'
import type { ButtonProps as ButtonPropsMantine, TooltipProps } from '@mantine/core/lib/components'
import { IconName } from 'jsapp/fonts/k-icons'
import { forwardRef } from 'react'
import Icon, { IconSize } from './icon'

/** To be used for buttons with both icon and text. */
const ButtonToIconMap: Partial<Record<NonNullable<ButtonProps['size']>, IconSize>> = {
  sm: 'xs',
  md: 's',
  lg: 'm',
}

/** To be used for icon-only buttons. */
const ButtonToIconAloneMap: Partial<Record<NonNullable<ButtonProps['size']>, IconSize>> = {
  sm: 'm',
  md: 'l',
  lg: 'l',
}

export interface ButtonProps extends ButtonPropsMantine {
  tooltip?: React.ReactNode
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  // Standard way of using icons with deterministic sizes.
  leftIcon?: IconName
  rightIcon?: IconName
  leftSection?: never
  rightSection?: never
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tooltip, tooltipProps, leftIcon, rightIcon, ...others }, ref) => {
    const iconSize = (others.children ? ButtonToIconMap : ButtonToIconAloneMap)[others.size ?? 'sm']
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
