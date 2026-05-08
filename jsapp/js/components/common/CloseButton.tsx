// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper for the component
import { CloseButton as CloseButtonMantine, Tooltip, createPolymorphicComponent } from '@mantine/core'
import type { CloseButtonProps as CloseButtonPropsMantine, TooltipProps } from '@mantine/core'
import { forwardRef } from 'react'

export interface CloseButtonProps extends CloseButtonPropsMantine {
  /** Text for tooltip */
  tooltip?: React.ReactNode
  /** Additional tooltip configuration */
  tooltipProps?: Partial<Omit<TooltipProps, 'label'>>
}

const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(({ tooltip, tooltipProps, ...props }, ref) => {
  if (!tooltip) {
    return <CloseButtonMantine {...props} ref={ref} />
  }

  return (
    <Tooltip label={tooltip} {...tooltipProps}>
      <CloseButtonMantine {...props} ref={ref} />
    </Tooltip>
  )
})
CloseButton.displayName = 'CloseButton'

export default createPolymorphicComponent<'button', CloseButtonProps>(CloseButton)
