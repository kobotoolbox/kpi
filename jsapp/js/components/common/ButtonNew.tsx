import { Button as ButtonMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { MantineSize } from '@mantine/core'
import type { ButtonProps as ButtonPropsMantine, TooltipProps } from '@mantine/core/lib/components'
import type { IconProps as SvgIconProps, TablerIcon } from '@tabler/icons-react'
import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { IconName } from '#/k-icons'
import KoboIcon from './KoboIcon'
import MixedIcon from './MixedIcon'
import type { IconSize } from './icon'

const ButtonToIconMap: Partial<Record<NonNullable<ButtonProps['size']>, IconSize>> = {
  sm: 'xs',
  md: 's',
  lg: 'm',
}

// See boilerplate at: https://mantine.dev/guides/polymorphic/#wrapping-polymorphic-components

export interface ButtonProps extends ButtonPropsMantine {
  tooltip?: React.ReactNode
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>

  // Standard way of using icons with deterministic sizes.
  // Note: never use Button with just an icon and no text - if you need that, use `ActionIcon` instead.
  // Accepts IconName (legacy), TablerIcon (component), or resolved SVG components from resolvers.
  leftIcon?: IconName | TablerIcon | ComponentType<SvgIconProps>
  rightIcon?: IconName | TablerIcon | ComponentType<SvgIconProps>
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tooltip, tooltipProps, leftIcon, rightIcon, leftSection, rightSection, ...others }, ref) => {
    const buttonSize = (others.size ?? 'sm') as MantineSize
    const legacyIconSize = ButtonToIconMap[others.size ?? 'sm']

    const resolvedLeftSection =
      leftSection ??
      (leftIcon &&
        (typeof leftIcon === 'string' ? (
          <MixedIcon icon={leftIcon} size={legacyIconSize ?? buttonSize} />
        ) : (
          <KoboIcon icon={leftIcon} size={buttonSize} />
        )))
    const resolvedRightSection =
      rightSection ??
      (rightIcon &&
        (typeof rightIcon === 'string' ? (
          <MixedIcon icon={rightIcon} size={legacyIconSize ?? buttonSize} />
        ) : (
          <KoboIcon icon={rightIcon} size={buttonSize} />
        )))

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
