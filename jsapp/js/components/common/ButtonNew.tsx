import { Button as ButtonMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { ButtonProps as ButtonPropsMantine, TooltipProps } from '@mantine/core/lib/components'
import type { TablerIcon } from '@tabler/icons-react'
import { forwardRef } from 'react'
import type { IconName } from '#/k-icons'
import KoboIcon from './KoboIcon'
import type { IconSize } from './icon'

const ButtonToIconMap: Partial<Record<NonNullable<ButtonProps['size']>, IconSize>> = {
  sm: 'xs',
  md: 's',
  lg: 'm',
}

function renderButtonIcon(icon: IconName | TablerIcon | undefined, iconSize: IconSize | undefined) {
  if (!icon) {
    return undefined
  }

  if (typeof icon === 'string') {
    return <KoboIcon name={icon} size={iconSize} />
  }

  return <KoboIcon icon={icon} size={iconSize} />
}

// See boilerplate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components

export interface ButtonProps extends ButtonPropsMantine {
  tooltip?: React.ReactNode
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  // Standard way of using icons with deterministic sizes.
  // Note: never use Button with just an icon and no text - if you need that, use `ActionIcon` instead.
  leftIcon?: IconName | TablerIcon
  rightIcon?: IconName | TablerIcon
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tooltip, tooltipProps, leftIcon, rightIcon, leftSection, rightSection, ...others }, ref) => {
    const iconSize = ButtonToIconMap[others.size ?? 'sm']
    const resolvedLeftSection = leftSection ?? renderButtonIcon(leftIcon, iconSize)
    const resolvedRightSection = rightSection ?? renderButtonIcon(rightIcon, iconSize)

    if (!tooltip) {
      return (
        <ButtonMantine {...others} leftSection={resolvedLeftSection} rightSection={resolvedRightSection} ref={ref} />
      )
    }

    return (
      <Tooltip label={tooltip} {...tooltipProps}>
        <ButtonMantine {...others} leftSection={resolvedLeftSection} rightSection={resolvedRightSection} ref={ref} />
      </Tooltip>
    )
  },
)
Button.displayName = 'Button'

// See boilerplate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components
/**
 * For the button variants we use built in ones when possible. This means:
 * - "filled" means "primary"
 * - "light" means "secondary"
 * - "outline" means "tertiary"
 * - "transparent" means what it says
 *
 * Custom ones are:
 * - "danger"
 * - "danger-secondary"
 */
export default createPolymorphicComponent<'button', ButtonProps>(Button)
